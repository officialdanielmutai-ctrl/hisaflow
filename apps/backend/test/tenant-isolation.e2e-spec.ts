import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/infrastructure/prisma.service';
import { createE2eApp, request, truncateAll } from './utils/e2e-app';

describe('Multi-tenant isolation (e2e, real Postgres)', () => {
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
  });

  async function seedOrg(label: string, memberRole: 'OWNER' | 'MANAGER' | 'STAFF' = 'OWNER') {
    const org = await prisma.db.organization.create({
      data: { name: label, businessType: 'RETAIL' },
    });
    const member = await prisma.db.user.create({
      data: { clerkId: `${label}-${memberRole}`, name: `${label} ${memberRole}` },
    });
    await prisma.db.orgMembership.create({
      data: { organizationId: org.id, userId: member.id, role: memberRole },
    });
    const item = await prisma.db.inventoryItem.create({
      data: {
        organizationId: org.id,
        name: `${label} Item`,
        unit: 'units',
        quantity: new Prisma.Decimal(50),
        sellingPrice: new Prisma.Decimal('10.00'),
        costPrice: new Prisma.Decimal('4.00'),
      },
    });
    return { org, member, item };
  }

  async function sell(orgId: string, userId: string, itemId: string, quantity: number) {
    return request(app, '/transactions', {
      method: 'POST',
      orgId,
      userId,
      body: { itemId, type: 'SALE', quantity },
    });
  }

  it('GET /transactions only ever returns the calling org rows', async () => {
    const alpha = await seedOrg('Alpha');
    const beta = await seedOrg('Beta');
    await sell(alpha.org.id, alpha.member.id, alpha.item.id, 2);
    await sell(beta.org.id, beta.member.id, beta.item.id, 7);

    const alphaRows = await request(app, '/transactions', {
      orgId: alpha.org.id,
      userId: alpha.member.id,
    });
    expect(alphaRows.status).toBe(200);
    expect(alphaRows.body).toHaveLength(1);
    expect(alphaRows.body[0].quantity).toBe(-2);

    const betaRows = await request(app, '/transactions', {
      orgId: beta.org.id,
      userId: beta.member.id,
    });
    expect(betaRows.body).toHaveLength(1);
    expect(betaRows.body[0].quantity).toBe(-7);
  });

  it('cannot transact against another org inventory item', async () => {
    const alpha = await seedOrg('Alpha');
    const beta = await seedOrg('Beta');

    const response = await sell(alpha.org.id, alpha.member.id, beta.item.id, 1);

    expect(response.status).toBe(400);
    const betaItem = await prisma.db.inventoryItem.findUniqueOrThrow({ where: { id: beta.item.id } });
    expect(betaItem.quantity.toString()).toBe('50');
    const alphaLedger = await prisma.db.inventoryTransaction.count({
      where: { organizationId: alpha.org.id },
    });
    expect(alphaLedger).toBe(0);
  });

  it('scopes business-ledger reads and writes by organisation', async () => {
    const alpha = await seedOrg('Alpha');
    const beta = await seedOrg('Beta');

    await request(app, '/finance/business-transactions', {
      method: 'POST',
      orgId: alpha.org.id,
      userId: alpha.member.id,
      body: { type: 'EXPENSE', category: 'RENT', amount: 100 },
    });
    await request(app, '/finance/business-transactions', {
      method: 'POST',
      orgId: beta.org.id,
      userId: beta.member.id,
      body: { type: 'EXPENSE', category: 'RENT', amount: 999 },
    });

    const alphaRows = await request(app, '/finance/business-transactions', {
      orgId: alpha.org.id,
      userId: alpha.member.id,
    });

    expect(alphaRows.body).toHaveLength(1);
    expect(alphaRows.body[0].amount).toBe(100);
  });

  it('enforces role restrictions with the real RolesGuard', async () => {
    const staffOrg = await seedOrg('StaffOrg', 'STAFF');
    const ownerOrg = await seedOrg('OwnerOrg', 'OWNER');

    const staffDenied = await request(app, '/finance/overview', {
      orgId: staffOrg.org.id,
      userId: staffOrg.member.id,
    });
    expect(staffDenied.status).toBe(403);

    const ownerAllowed = await request(app, '/finance/overview', {
      orgId: ownerOrg.org.id,
      userId: ownerOrg.member.id,
    });
    expect(ownerAllowed.status).toBe(200);
  });

  it('rejects a request without an organisation context', async () => {
    const alpha = await seedOrg('Alpha');

    const response = await request(app, '/finance/overview', {
      userId: alpha.member.id,
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
