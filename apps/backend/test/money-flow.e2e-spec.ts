import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/infrastructure/prisma.service';
import { StockBatchesService } from '../src/modules/stock-batches/stock-batches.service';
import { createE2eApp, request, truncateAll } from './utils/e2e-app';

describe('Money flow (e2e, real Postgres)', () => {
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

  async function seedOrg(label: string) {
    const org = await prisma.db.organization.create({
      data: { name: label, businessType: 'RETAIL' },
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
        quantity: new Prisma.Decimal('10.500'),
        sellingPrice: new Prisma.Decimal('120.00'),
        costPrice: new Prisma.Decimal('90.00'),
      },
    });
    return { org, owner, item };
  }

  it('defaults a new organisation to KES', async () => {
    const { org } = await seedOrg('Currency');

    expect(org.currency).toBe('KES');
  });

  it('POST /transactions deducts stock and writes a ledger row atomically', async () => {
    const { org, owner, item } = await seedOrg('Alpha');

    const response = await request(app, '/transactions', {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
      body: { itemId: item.id, type: 'SALE', quantity: 2.5 },
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ success: true, newQuantity: 8 });

    const refreshed = await prisma.db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(refreshed.quantity.toString()).toBe('8');

    const ledger = await prisma.db.inventoryTransaction.findMany({
      where: { organizationId: org.id },
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].quantityChange.toString()).toBe('-2.5');
    expect(ledger[0].quantityAfter.toString()).toBe('8');
  });

  it('rejects a negative quantity through the global ValidationPipe', async () => {
    const { org, owner, item } = await seedOrg('Negative');

    const response = await request(app, '/transactions', {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
      body: { itemId: item.id, type: 'SALE', quantity: -5 },
    });

    expect(response.status).toBe(400);
    const ledgerCount = await prisma.db.inventoryTransaction.count({ where: { organizationId: org.id } });
    expect(ledgerCount).toBe(0);
  });

  it('rejects a sale beyond available stock without touching the database', async () => {
    const { org, owner, item } = await seedOrg('Overdraw');

    const response = await request(app, '/transactions', {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
      body: { itemId: item.id, type: 'SALE', quantity: 999 },
    });

    expect(response.status).toBe(400);
    const refreshed = await prisma.db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(refreshed.quantity.toString()).toBe('10.5');
    const ledgerCount = await prisma.db.inventoryTransaction.count({ where: { organizationId: org.id } });
    expect(ledgerCount).toBe(0);
  });

  it('applies a tiered price and persists it in the ledger metadata', async () => {
    const { org, owner, item } = await seedOrg('Tiered');
    await prisma.db.tieredPriceRule.create({
      data: {
        organizationId: org.id,
        inventoryItemId: item.id,
        minQuantity: new Prisma.Decimal(5),
        pricePerUnit: new Prisma.Decimal('100.00'),
      },
    });

    const response = await request(app, '/transactions', {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
      body: { itemId: item.id, type: 'SALE', quantity: 5 },
    });

    expect(response.status).toBe(201);
    const ledger = await prisma.db.inventoryTransaction.findFirstOrThrow({
      where: { organizationId: org.id },
    });
    expect(ledger.metadata).toMatchObject({ appliedTierPrice: 100 });
  });

  it('round-trips an operating expense into the business overview', async () => {
    const { org, owner } = await seedOrg('P&L');

    const created = await request(app, '/finance/business-transactions', {
      method: 'POST',
      orgId: org.id,
      userId: owner.id,
      body: { type: 'EXPENSE', category: 'RENT', amount: 1000.5 },
    });
    expect(created.status).toBe(201);

    const overview = await request(app, '/finance/business-overview', {
      orgId: org.id,
      userId: owner.id,
    });

    expect(overview.status).toBe(200);
    expect(overview.body.totalOperatingExpenses).toBe(1000.5);
    expect(overview.body.netProfit).toBe(-1000.5);
  });

  it('rolls back a multi-write transaction when a later write fails', async () => {
    const alpha = await seedOrg('AtomicA');
    const beta = await seedOrg('AtomicB');
    const stockBatches = app.get(StockBatchesService);

    // The batch insert succeeds (the item exists), then the org-scoped item
    // lookup fails because the item belongs to another org. The whole Prisma
    // interactive transaction must roll back, leaving no batch behind.
    await expect(
      stockBatches.create(
        {
          inventoryItemId: beta.item.id,
          batchNumber: 'B-ROLLBACK',
          expiryDate: '2027-01-01',
          quantity: 5,
        },
        alpha.org.id,
      ),
    ).rejects.toBeTruthy();

    const batches = await prisma.db.stockBatch.count({ where: { organizationId: alpha.org.id } });
    expect(batches).toBe(0);
    const betaItem = await prisma.db.inventoryItem.findUniqueOrThrow({ where: { id: beta.item.id } });
    expect(betaItem.quantity.toString()).toBe('10.5');
  });
});
