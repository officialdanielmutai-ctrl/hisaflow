import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma.service';
import { EntitlementsService } from '../../core/entitlements/entitlements.service';
import { TierFeature } from '../../core/entitlements/entitlements.constant';
import { TaxAggregationService } from './tax-aggregation.service';

function dec(value: string | number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function build(opts: {
  entitled?: boolean;
  records?: Record<string, unknown>[];
}) {
  const findMany = jest.fn(async () => opts.records ?? []);
  const prisma = {
    db: { taxInvoiceRecord: { findMany } },
  } as unknown as PrismaService;

  const assertFeatures =
    opts.entitled === false
      ? jest.fn(async () => {
          throw new Error('Feature Locked');
        })
      : jest.fn(async () => ({}));
  const entitlements = { assertFeatures } as unknown as EntitlementsService;

  return {
    service: new TaxAggregationService(prisma, entitlements),
    findMany,
    assertFeatures,
  };
}

describe('TaxAggregationService (Phase F)', () => {
  it("aggregates tax across an org's locations, not one summary per location to add up", async () => {
    const { service } = build({
      records: [
        {
          status: 'SYNCED',
          netAmount: dec(1000),
          taxAmount: dec(160),
          grossAmount: dec(1160),
          invoice: { subscriber: { router: { label: 'Tower A - Main POP' } } },
        },
        {
          status: 'SYNCED',
          netAmount: dec(2000),
          taxAmount: dec(320),
          grossAmount: dec(2320),
          invoice: { subscriber: { router: { label: 'Tower B' } } },
        },
        {
          status: 'PENDING',
          netAmount: dec(500),
          taxAmount: dec(80),
          grossAmount: dec(580),
          invoice: { subscriber: null },
        },
      ],
    });

    const view = await service.getAggregatedView('org_1');

    expect(view.locationCount).toBe(3);
    expect(view.locations.map((location) => location.location)).toEqual(
      expect.arrayContaining(['Tower A - Main POP', 'Tower B', 'Main location']),
    );
    expect(view.totals.filed).toBe(2);
    expect(view.totals.pending).toBe(1);
    expect(view.totals.taxAmount).toBe(480);
    expect(view.totals.grossAmount).toBe(3480);
    expect(view.totals.pendingTaxAmount).toBe(80);
  });

  it('reuses the existing MultiLocation (Growth) gate', async () => {
    const { service, assertFeatures } = build({ entitled: false });

    await expect(service.getAggregatedView('org_1')).rejects.toThrow(
      'Feature Locked',
    );
    expect(assertFeatures).toHaveBeenCalledWith('org_1', [
      TierFeature.MultiLocation,
    ]);
  });

  it('scopes the query to the requested period', async () => {
    const { service, findMany } = build({ records: [] });

    await service.getAggregatedView('org_1', {
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-10-01T00:00:00.000Z',
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org_1',
          createdAt: {
            gte: new Date('2026-09-01T00:00:00.000Z'),
            lt: new Date('2026-10-01T00:00:00.000Z'),
          },
        },
      }),
    );
  });
});
