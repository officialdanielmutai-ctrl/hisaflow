import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/infrastructure/prisma.service';
import { createE2eApp, request, truncateAll } from './utils/e2e-app';

/**
 * Live verification of the assistant's single governed write path against a
 * real Postgres database. This closes the "staging e2e pending" item for the
 * assistant foundation: it proves, with a database, that a write cannot mutate
 * without an approved proposal, that approved args are immutable, that
 * execution is idempotent, and that tenants are isolated.
 *
 * Auth is the harness's header-driven Clerk stub (see e2e-app.ts); feature
 * flags are seeded per test. No model provider is called — this exercises the
 * deterministic propose/approve/execute contract, not the LLM loop.
 */
describe('Assistant governed write path (e2e, real Postgres)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    await prisma.db.featureFlag.createMany({
      data: [
        { key: 'assistant.read', scope: 'GLOBAL', scopeValue: '', enabled: true, rolloutPct: 100 },
        { key: 'assistant.write', scope: 'GLOBAL', scopeValue: '', enabled: true, rolloutPct: 100 },
        { key: 'assistant.communicate', scope: 'GLOBAL', scopeValue: '', enabled: true, rolloutPct: 100 },
      ],
    });
  });

  async function seedOrg(label: string, businessType: string) {
    const org = await prisma.db.organization.create({
      data: { name: label, businessType },
    });
    const owner = await prisma.db.user.create({
      data: { clerkId: `${label}-owner`, name: 'Owner' },
    });
    await prisma.db.orgMembership.create({
      data: { organizationId: org.id, userId: owner.id, role: 'OWNER' },
    });
    const item = await prisma.db.inventoryItem.create({
      data: {
        organizationId: org.id,
        name: `${label} Sugar`,
        unit: 'kg',
        quantity: new Prisma.Decimal('10'),
        reorderThreshold: new Prisma.Decimal('5'),
        sellingPrice: new Prisma.Decimal('120'),
      },
    });
    return { org, owner, item };
  }

  it('offers the org its vertical tool set only', async () => {
    const { org, owner } = await seedOrg('Toolset', 'DUKA');

    const response = await request(app, '/assistant/tools', {
      orgId: org.id,
      userId: owner.id,
    });

    expect(response.status).toBe(200);
    const names = (response.body.tools as Array<{ name: string }>).map((t) => t.name);
    expect(names).toContain('record_sale');
    expect(names).toContain('create_note');
    expect(names).toContain('list_inventory');
    expect(names).not.toContain('create_subscriber');
    expect(names).not.toContain('create_booking');
  });

  it('auto-runs a read tool against the database', async () => {
    const { org, owner, item } = await seedOrg('Read', 'DUKA');
    await prisma.db.inventoryItem.update({
      where: { id: item.id },
      data: { quantity: new Prisma.Decimal('2') },
    });

    const response = await request(app, '/assistant/tools/get_low_stock/run', {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
      body: { args: { limit: 10 } },
    });

    expect(response.status).toBe(201);
    expect(response.body.result).toEqual([
      expect.objectContaining({ id: item.id, quantity: 2 }),
    ]);
  });

  it('lists inventory for the org and returns an empty list (never invented rows)', async () => {
    const { org, owner, item } = await seedOrg('ListInventory', 'GUEST_HOUSE');

    const withItems = await request(app, '/assistant/tools/list_inventory/run', {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
      body: { args: { limit: 20 } },
    });
    expect(withItems.status).toBe(201);
    expect(withItems.body.result).toEqual([
      expect.objectContaining({ id: item.id, name: expect.any(String) }),
    ]);

    // An org with no inventory must get an empty list, which is what lets the
    // assistant say "no items" instead of hallucinating products.
    const empty = await seedOrg('ListInventoryEmpty', 'GUEST_HOUSE');
    await prisma.db.inventoryItem.deleteMany({
      where: { organizationId: empty.org.id },
    });
    const emptyResponse = await request(app, '/assistant/tools/list_inventory/run', {
      method: 'POST',
      orgId: empty.org.id,
      userId: empty.owner.id,
      body: { args: {} },
    });
    expect(emptyResponse.status).toBe(201);
    expect(emptyResponse.body.result).toEqual([]);
  });

  it('does not mutate until an approved proposal is executed, and is idempotent', async () => {
    const { org, owner, item } = await seedOrg('Write', 'DUKA');

    const proposed = await request(app, '/assistant/proposals', {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
      body: { tool: 'record_sale', args: { itemId: item.id, quantity: 3 } },
    });
    expect(proposed.status).toBe(201);
    expect(proposed.body.proposal).toMatchObject({
      tool: 'record_sale',
      status: 'PROPOSED',
      riskLevel: 'medium',
    });
    const proposalId = proposed.body.proposal.id as string;

    // Proposed only: stock untouched, no ledger row.
    expect(
      (await prisma.db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).quantity.toString(),
    ).toBe('10');
    expect(await prisma.db.inventoryTransaction.count()).toBe(0);

    // Cannot execute before approval.
    const premature = await request(app, `/assistant/proposals/${proposalId}/execute`, {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
    });
    expect(premature.status).toBe(403);
    expect(await prisma.db.inventoryTransaction.count()).toBe(0);

    const approved = await request(app, `/assistant/proposals/${proposalId}/approve`, {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
    });
    expect(approved.status).toBe(201);
    expect(approved.body.proposal.status).toBe('APPROVED');

    const executed = await request(app, `/assistant/proposals/${proposalId}/execute`, {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
    });
    expect(executed.status).toBe(201);
    expect(executed.body).toMatchObject({ status: 'EXECUTED', idempotent: false });

    expect(
      (await prisma.db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).quantity.toString(),
    ).toBe('7');
    expect(await prisma.db.inventoryTransaction.count()).toBe(1);

    const again = await request(app, `/assistant/proposals/${proposalId}/execute`, {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
    });
    expect(again.status).toBe(201);
    expect(again.body).toMatchObject({ status: 'EXECUTED', idempotent: true });
    expect(
      (await prisma.db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).quantity.toString(),
    ).toBe('7');
    expect(await prisma.db.inventoryTransaction.count()).toBe(1);
  });

  it('refuses to execute approved arguments that changed after approval', async () => {
    const { org, owner, item } = await seedOrg('Immutable', 'DUKA');

    const proposed = await request(app, '/assistant/proposals', {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
      body: { tool: 'record_sale', args: { itemId: item.id, quantity: 3 } },
    });
    const proposalId = proposed.body.proposal.id as string;
    await request(app, `/assistant/proposals/${proposalId}/approve`, {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
    });

    // Tamper with the approved payload out-of-band.
    await prisma.db.assistantProposal.update({
      where: { id: proposalId },
      data: { argsJson: JSON.stringify({ itemId: item.id, quantity: 999 }) },
    });

    const executed = await request(app, `/assistant/proposals/${proposalId}/execute`, {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
    });
    expect(executed.status).toBe(400);
    expect(await prisma.db.inventoryTransaction.count()).toBe(0);
  });

  it('isolates proposals across tenants', async () => {
    const a = await seedOrg('TenantA', 'DUKA');
    const b = await seedOrg('TenantB', 'DUKA');

    const proposed = await request(app, '/assistant/proposals', {
      method: 'POST',
      orgId: a.org.id,
      userId: a.owner.id,
      body: { tool: 'record_sale', args: { itemId: a.item.id, quantity: 1 } },
    });
    const proposalId = proposed.body.proposal.id as string;

    // Org B cannot see or act on org A's proposal.
    const list = await request(app, '/assistant/proposals', {
      orgId: b.org.id,
      userId: b.owner.id,
    });
    expect(list.body.proposals).toHaveLength(0);

    const approve = await request(app, `/assistant/proposals/${proposalId}/approve`, {
      method: 'POST',
      orgId: b.org.id,
      userId: b.owner.id,
    });
    expect(approve.status).toBe(404);
  });

  it('denies a write when its feature flag is off', async () => {
    const { org, owner, item } = await seedOrg('FlagOff', 'DUKA');
    await prisma.db.featureFlag.updateMany({
      where: { key: 'assistant.write' },
      data: { enabled: false },
    });

    const proposed = await request(app, '/assistant/proposals', {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
      body: { tool: 'record_sale', args: { itemId: item.id, quantity: 1 } },
    });
    expect(proposed.status).toBe(403);
    expect(await prisma.db.assistantProposal.count()).toBe(0);
  });

  it('revise creates a new version and supersedes the old proposal', async () => {
    const { org, owner, item } = await seedOrg('Revise', 'DUKA');

    const proposed = await request(app, '/assistant/proposals', {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
      body: { tool: 'record_sale', args: { itemId: item.id, quantity: 3 } },
    });
    const originalId = proposed.body.proposal.id as string;
    expect(proposed.body.proposal.version).toBe(1);

    const revised = await request(app, `/assistant/proposals/${originalId}/revise`, {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
      body: { args: { itemId: item.id, quantity: 5 } },
    });
    expect(revised.status).toBe(201);
    expect(revised.body.proposal.id).not.toBe(originalId);
    expect(revised.body.proposal.version).toBe(2);
    expect(revised.body.proposal.status).toBe('PROPOSED');
    expect(revised.body.proposal.args).toMatchObject({ quantity: 5 });

    const superseded = await prisma.db.assistantProposal.findUniqueOrThrow({
      where: { id: originalId },
    });
    expect(superseded.status).toBe('REJECTED');

    const newId = revised.body.proposal.id as string;
    await request(app, `/assistant/proposals/${newId}/approve`, {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
    });
    const executed = await request(app, `/assistant/proposals/${newId}/execute`, {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
    });
    expect(executed.status).toBe(201);
    expect(
      (await prisma.db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).quantity.toString(),
    ).toBe('5');
  });

  it('a rejected proposal can never be executed', async () => {
    const { org, owner, item } = await seedOrg('Reject', 'DUKA');

    const proposed = await request(app, '/assistant/proposals', {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
      body: { tool: 'record_sale', args: { itemId: item.id, quantity: 2 } },
    });
    const proposalId = proposed.body.proposal.id as string;

    const rejected = await request(app, `/assistant/proposals/${proposalId}/reject`, {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
    });
    expect(rejected.status).toBe(201);
    expect(rejected.body.proposal.status).toBe('REJECTED');

    const approve = await request(app, `/assistant/proposals/${proposalId}/approve`, {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
    });
    expect(approve.status).toBeGreaterThanOrEqual(400);

    const execute = await request(app, `/assistant/proposals/${proposalId}/execute`, {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
    });
    expect(execute.status).toBeGreaterThanOrEqual(400);
    expect(await prisma.db.inventoryTransaction.count()).toBe(0);
  });

  it('records and lists an unsupported intent through the utility tool', async () => {
    const { org, owner } = await seedOrg('Fallback', 'DUKA');

    const logged = await request(app, '/assistant/tools/log_unsupported_intent/run', {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
      body: { args: { request: 'file my KRA return for last month' } },
    });
    expect(logged.status).toBe(201);
    expect(logged.body.result).toEqual({ recorded: true });

    const listed = await request(app, '/assistant/unsupported', {
      orgId: org.id,
      userId: owner.id,
    });
    expect(listed.status).toBe(200);
    expect(listed.body.intents).toHaveLength(1);
    expect(listed.body.intents[0]).toMatchObject({
      organizationId: org.id,
      intent: 'file my KRA return for last month',
    });
  });

  it('communicate tools only send after approval and honour opt-out consent', async () => {
    const { org, owner } = await seedOrg('Comms', 'DUKA');
    const recipient = 'customer@example.com';

    const proposed = await request(app, '/assistant/proposals', {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
      body: {
        tool: 'send_email',
        args: { recipient, subject: 'Your order', message: 'Ready for pickup.' },
      },
    });
    expect(proposed.status).toBe(201);
    // No message is sent while it is only proposed.
    expect(await prisma.db.assistantOutboundMessage.count()).toBe(0);

    const proposalId = proposed.body.proposal.id as string;
    await request(app, `/assistant/proposals/${proposalId}/approve`, {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
    });
    const executed = await request(app, `/assistant/proposals/${proposalId}/execute`, {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
    });
    expect(executed.status).toBe(201);
    expect(executed.body.result).toMatchObject({ status: 'MOCKED', recipient });

    const sent = await prisma.db.assistantOutboundMessage.findMany({
      where: { organizationId: org.id },
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ channel: 'EMAIL', status: 'MOCKED', recipient });

    // A recorded opt-out blocks a new proposal at build time.
    await prisma.db.communicationConsent.create({
      data: { clerkUserId: 'opted-out-customer', email: recipient, emailStatus: 'OPTED_OUT' },
    });
    const blocked = await request(app, '/assistant/proposals', {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
      body: {
        tool: 'send_email',
        args: { recipient, subject: 'Again', message: 'Second message.' },
      },
    });
    expect(blocked.status).toBe(403);
    expect(await prisma.db.assistantProposal.count({ where: { organizationId: org.id } })).toBe(1);
  });

  it('runs a vertical tool end to end (ISP create_subscriber)', async () => {
    const { org, owner } = await seedOrg('Isp', 'ISP');

    const proposed = await request(app, '/assistant/proposals', {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
      body: {
        tool: 'create_subscriber',
        args: { name: 'John Doe', phone: '0712345678' },
      },
    });
    expect(proposed.status).toBe(201);
    expect(proposed.body.proposal.tool).toBe('create_subscriber');
    const proposalId = proposed.body.proposal.id as string;

    await request(app, `/assistant/proposals/${proposalId}/approve`, {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
    });
    const executed = await request(app, `/assistant/proposals/${proposalId}/execute`, {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
    });
    expect(executed.status).toBe(201);
    expect(executed.body.status).toBe('EXECUTED');

    const subscriber = await prisma.db.subscriber.findFirst({
      where: { organizationId: org.id },
    });
    expect(subscriber).toMatchObject({ name: 'John Doe', phone: '0712345678' });
  });
});
