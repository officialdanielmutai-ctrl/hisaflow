import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma.service';
import { EntitlementsService } from '../../core/entitlements/entitlements.service';
import { NotificationsService } from '../notifications/notifications.service';
import { filingDeadlineFor } from './tax-period';
import { TaxReconciliationService } from './tax-reconciliation.service';

function dec(value: string | number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function build(opts: {
  entitled?: boolean;
  assertThrows?: boolean;
  invoices?: Record<string, unknown>[];
  records?: Record<string, unknown>[];
}) {
  const invoiceFindMany = jest.fn(
    async (_args?: unknown) => opts.invoices ?? [],
  );
  const recordFindMany = jest.fn(async () => opts.records ?? []);
  const registrationFindMany = jest.fn(async () => [
    { organizationId: 'org_1' },
  ]);
  const alertUpdateMany = jest.fn(async () => ({ count: 0 }));
  const alertFindMany = jest.fn(async () => [] as unknown[]);
  const alertCreate = jest.fn(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'alert_1',
      ...data,
    }),
  );

  const prisma = {
    db: {
      invoice: { findMany: invoiceFindMany },
      taxInvoiceRecord: { findMany: recordFindMany },
      taxRegistration: { findMany: registrationFindMany },
      alert: {
        updateMany: alertUpdateMany,
        findMany: alertFindMany,
        create: alertCreate,
      },
    },
  } as unknown as PrismaService;

  const hasFeature = jest.fn(async () => opts.entitled ?? true);
  const assertFeatures = opts.assertThrows
    ? jest.fn(async () => {
        throw new Error('Feature Locked');
      })
    : jest.fn(async () => ({}));
  const entitlements = {
    hasFeature,
    assertFeatures,
  } as unknown as EntitlementsService;

  const notificationsSend = jest.fn(async () => undefined);
  const notifications = {
    sendPushToOrganization: notificationsSend,
  } as unknown as NotificationsService;

  return {
    service: new TaxReconciliationService(prisma, entitlements, notifications),
    invoiceFindMany,
    recordFindMany,
    alertUpdateMany,
    alertFindMany,
    alertCreate,
    hasFeature,
    assertFeatures,
    notificationsSend,
  };
}

describe('TaxReconciliationService (Phase E)', () => {
  it('flags a deliberately blocked sync as an anomaly before the deadline', async () => {
    const ctx = build({
      invoices: [
        {
          id: 'inv_blocked',
          status: 'ISSUED',
          taxTotal: dec(160),
          createdAt: new Date('2026-09-05T00:00:00.000Z'),
        },
      ],
      records: [],
    });

    const result = await ctx.service.runForOrganization(
      'org_1',
      new Date('2026-09-15T00:00:00.000Z'),
    );

    expect(result).toEqual({ skipped: false, anomalies: 1 });
    expect(ctx.alertCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'TAX_RECONCILIATION_MISMATCH',
          itemId: 'SALE_NOT_FILED:inv_blocked',
        }),
      }),
    );
  });

  it('does not duplicate an alert that already exists', async () => {
    const ctx = build({
      invoices: [
        {
          id: 'inv_blocked',
          status: 'ISSUED',
          taxTotal: dec(160),
          createdAt: new Date('2026-09-05T00:00:00.000Z'),
        },
      ],
      records: [],
    });
    ctx.alertFindMany.mockResolvedValue([
      { id: 'alert_1', itemId: 'SALE_NOT_FILED:inv_blocked' },
    ]);

    const result = await ctx.service.runForOrganization('org_1');

    expect(result.anomalies).toBe(1);
    expect(ctx.alertCreate).not.toHaveBeenCalled();
  });

  it('resolves an alert when its invoice is re-checked and now matches', async () => {
    const ctx = build({
      invoices: [
        {
          id: 'inv_ok',
          status: 'ISSUED',
          taxTotal: dec(160),
          createdAt: new Date('2026-09-05T00:00:00.000Z'),
        },
      ],
      records: [
        {
          invoiceId: 'inv_ok',
          status: 'SYNCED',
          taxAmount: dec(160),
          invoice: { status: 'ISSUED' },
          createdAt: new Date('2026-09-05T00:00:00.000Z'),
        },
      ],
    });
    ctx.alertFindMany.mockResolvedValue([
      { id: 'alert_ok', itemId: 'SALE_NOT_SYNCED:inv_ok' },
    ]);

    await ctx.service.runForOrganization('org_1');

    expect(ctx.alertUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['alert_ok'] } },
        data: expect.objectContaining({ status: 'RESOLVED' }),
      }),
    );
  });

  it('re-checks an old period with a still-open alert and does not clear it', async () => {
    const oldDate = new Date('2026-07-05T00:00:00.000Z');
    const ctx = build({
      invoices: [
        {
          id: 'inv_old',
          status: 'ISSUED',
          taxTotal: dec(160),
          createdAt: oldDate,
        },
      ],
      records: [
        {
          invoiceId: 'inv_old',
          status: 'PENDING',
          taxAmount: dec(160),
          invoice: { status: 'ISSUED' },
          createdAt: oldDate,
        },
      ],
    });
    ctx.alertFindMany.mockResolvedValue([
      { id: 'alert_old', itemId: 'SALE_NOT_SYNCED:inv_old' },
    ]);

    const result = await ctx.service.runForOrganization(
      'org_1',
      new Date('2026-09-15T00:00:00.000Z'),
    );

    // July is outside the open window but is re-checked because of the alert.
    const periodStarts = ctx.invoiceFindMany.mock.calls
      .map(
        (call) =>
          (call[0] as {
            where?: { OR?: { issuedAt?: { gte?: Date } }[] };
          })?.where?.OR?.[0]?.issuedAt?.gte,
      )
      .filter((date): date is Date => date instanceof Date);
    expect(
      periodStarts.some(
        (date) => date.toISOString() === '2026-07-01T00:00:00.000Z',
      ),
    ).toBe(true);

    expect(result.anomalies).toBe(1);
    // The still-open alert is not resolved and not duplicated.
    expect(ctx.alertUpdateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['alert_old'] } } }),
    );
    expect(ctx.alertCreate).not.toHaveBeenCalled();
  });

  it('skips a non-entitled (Solo) org without touching its invoices', async () => {
    const ctx = build({ entitled: false });

    const result = await ctx.service.runForOrganization('org_1');

    expect(result).toEqual({ skipped: true, anomalies: 0 });
    expect(ctx.invoiceFindMany).not.toHaveBeenCalled();
    expect(ctx.alertCreate).not.toHaveBeenCalled();
  });

  it('blocks the Team dashboard for a non-entitled org', async () => {
    const ctx = build({ assertThrows: true });

    await expect(ctx.service.getReport('org_1')).rejects.toThrow(
      'Feature Locked',
    );
    expect(ctx.assertFeatures).toHaveBeenCalled();
  });

  it('reports checked invoices and the filing deadline', async () => {
    const ctx = build({
      invoices: [
        { id: 'inv_1', status: 'ISSUED', taxTotal: dec(160) },
        { id: 'inv_2', status: 'PAID', taxTotal: dec(320) },
      ],
      records: [],
    });

    const report = await ctx.service.getReport('org_1', {
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-10-01T00:00:00.000Z',
    });

    expect(report.checkedInvoices).toBe(2);
    expect(report.period.label).toBe('September 2026');
    expect(report.filingDeadline.toISOString()).toBe(
      '2026-10-20T00:00:00.000Z',
    );
  });

  it('computes the VAT deadline as the 20th of the following month', () => {
    expect(
      filingDeadlineFor(new Date('2026-10-01T00:00:00.000Z')).toISOString(),
    ).toBe('2026-10-20T00:00:00.000Z');
  });
});
