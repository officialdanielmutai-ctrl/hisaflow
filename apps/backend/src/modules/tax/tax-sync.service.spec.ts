import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { VscuClient } from './vscu/vscu.client';
import { VscuApiError, VscuConnectionError } from './vscu/vscu.errors';
import { NETWORK_BACKOFF_MS, TaxSyncService } from './tax-sync.service';

function dec(value: string | number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function makeEntry(recordOverrides: Record<string, unknown> = {}) {
  const invoice = {
    id: 'inv_1',
    organizationId: 'org_1',
    createdAt: new Date('2026-09-30T09:00:00.000Z'),
    issuedAt: new Date('2026-09-30T09:00:00.000Z'),
    lineItems: [
      {
        id: 'li_1',
        description: 'Item',
        quantity: dec(1),
        unitPrice: dec(1160),
        netAmount: dec(1000),
        taxAmount: dec(160),
        taxRate: dec('0.16'),
      },
    ],
  };

  const record = {
    id: 'rec_1',
    organizationId: 'org_1',
    invoiceId: 'inv_1',
    status: 'PENDING',
    currency: 'KES',
    netAmount: dec(1000),
    taxAmount: dec(160),
    grossAmount: dec(1160),
    taxRate: dec('0.16'),
    vscuReceiptNumber: null,
    vscuInternalData: null,
    vscuReceiptSignature: null,
    signedAt: null,
    kraInvoiceNumber: null,
    syncedAt: null,
    lastError: null,
    invoice,
    ...recordOverrides,
  };

  return {
    id: 'q_1',
    organizationId: 'org_1',
    taxInvoiceRecordId: record.id,
    status: 'PENDING',
    attempts: 0,
    kraErrorCount: 0,
    nextAttemptAt: null,
    lastAttemptAt: null,
    lastError: null,
    lastErrorClass: null,
    enqueuedAt: new Date('2026-09-30T09:00:00.000Z'),
    resolvedAt: null,
    taxInvoiceRecord: record,
  };
}

function build(registrationStatus: string | null) {
  const queueFindMany = jest.fn(async () => [] as unknown[]);
  const queueUpdate = jest.fn(
    async ({ data }: { data: Record<string, unknown> }) => ({ ...data }),
  );
  const recordUpdate = jest.fn(
    async ({ data }: { data: Record<string, unknown> }) => ({ ...data }),
  );
  const alertFindFirst = jest.fn(async () => null);
  const alertCreate = jest.fn(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'alert_1',
      ...data,
    }),
  );
  const alertUpdate = jest.fn(async () => ({}));
  const alertUpdateMany = jest.fn(async () => ({ count: 1 }));
  const registrationFindUnique = jest.fn(async () =>
    registrationStatus
      ? { id: 'tr_1', kraPin: 'P051234567X', status: registrationStatus }
      : null,
  );
  const transaction = jest.fn(async (ops: Promise<unknown>[]) =>
    Promise.all(ops),
  );

  const prisma = {
    db: {
      taxRegistration: { findUnique: registrationFindUnique },
      taxSyncQueue: { findMany: queueFindMany, update: queueUpdate },
      taxInvoiceRecord: { update: recordUpdate },
      alert: {
        findFirst: alertFindFirst,
        create: alertCreate,
        update: alertUpdate,
        updateMany: alertUpdateMany,
      },
      $transaction: transaction,
    },
  } as unknown as PrismaService;

  const vscuSign = jest.fn();
  const vscuTransmit = jest.fn();
  const vscu = {
    sign: vscuSign,
    transmit: vscuTransmit,
  } as unknown as VscuClient;

  const notificationsSend = jest.fn(async () => undefined);
  const notifications = {
    sendPushToOrganization: notificationsSend,
  } as unknown as NotificationsService;

  const config = {
    get: (key: string) => (key === 'etims.branchId' ? '00' : undefined),
  } as unknown as ConfigService;

  return {
    service: new TaxSyncService(prisma, vscu, notifications, config),
    queueFindMany,
    queueUpdate,
    recordUpdate,
    alertFindFirst,
    alertCreate,
    alertUpdateMany,
    registrationFindUnique,
    vscuSign,
    vscuTransmit,
    notificationsSend,
  };
}

describe('TaxSyncService (Phase C offline queue)', () => {
  it('signs offline, queues silently, and syncs the same invoice on reconnect', async () => {
    const ctx = build('PRODUCTION_ACTIVE');

    // ── Sale completed while offline ──────────────────────────────────────
    ctx.queueFindMany.mockResolvedValueOnce([makeEntry()] as never);
    ctx.vscuSign.mockResolvedValueOnce({
      receiptNumber: '27',
      internalData: 'INT',
      receiptSignature: 'SIG',
    });
    ctx.vscuTransmit.mockRejectedValueOnce(
      new VscuConnectionError('fetch failed'),
    );

    const offlineRun = await ctx.service.processQueue(
      new Date('2026-09-30T10:00:00.000Z'),
    );

    expect(offlineRun.offline).toBe(1);
    expect(offlineRun.synced).toBe(0);

    // Signed locally despite being offline.
    expect(ctx.recordUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vscuInternalData: 'INT',
          vscuReceiptSignature: 'SIG',
          signedAt: expect.any(Date),
        }),
      }),
    );

    // Queued with a network-offline class and a future retry — no alert.
    const offlineUpdate = ctx.queueUpdate.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(offlineUpdate.data.attempts).toBe(1);
    expect(offlineUpdate.data.lastErrorClass).toBe('NETWORK_OFFLINE');
    expect(
      (offlineUpdate.data.nextAttemptAt as Date).getTime(),
    ).toBeGreaterThan(new Date('2026-09-30T10:00:00.000Z').getTime());
    expect(
      (offlineUpdate.data.nextAttemptAt as Date).getTime() -
        new Date('2026-09-30T10:00:00.000Z').getTime(),
    ).toBe(NETWORK_BACKOFF_MS[0]);
    expect(ctx.alertCreate).not.toHaveBeenCalled();
    expect(ctx.notificationsSend).not.toHaveBeenCalled();

    // ── Connectivity returns ──────────────────────────────────────────────
    const signedEntry = makeEntry({
      signedAt: new Date('2026-09-30T10:00:00.000Z'),
      vscuReceiptNumber: '27',
      vscuInternalData: 'INT',
      vscuReceiptSignature: 'SIG',
    });
    ctx.queueFindMany.mockResolvedValueOnce([signedEntry] as never);
    ctx.vscuTransmit.mockResolvedValueOnce({ kraInvoiceNumber: 'KRA-27' });

    const reconnectRun = await ctx.service.processQueue(
      new Date('2026-09-30T10:10:00.000Z'),
    );

    expect(reconnectRun.synced).toBe(1);
    expect(ctx.vscuSign).toHaveBeenCalledTimes(1); // already signed, not re-signed
    expect(ctx.recordUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'SYNCED',
          kraInvoiceNumber: 'KRA-27',
          syncedAt: expect.any(Date),
        }),
      }),
    );
    expect(ctx.alertUpdateMany).toHaveBeenCalled(); // any old alert resolved
  });

  it('backs off AND alerts on a real KRA error response (separate path)', async () => {
    const ctx = build('PRODUCTION_ACTIVE');
    ctx.queueFindMany.mockResolvedValueOnce([
      makeEntry({
        signedAt: new Date(),
        vscuReceiptNumber: '1',
        vscuInternalData: 'i',
        vscuReceiptSignature: 's',
      }),
    ] as never);
    ctx.vscuTransmit.mockRejectedValueOnce(new VscuApiError('KRA 500', '500'));

    const result = await ctx.service.processQueue(new Date());

    expect(result.kraErrors).toBe(1);
    const update = ctx.queueUpdate.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(update.data.kraErrorCount).toBe(1);
    expect(update.data.attempts).toBe(0); // counted as a KRA error, not offline
    expect(update.data.lastErrorClass).toBe('KRA_ERROR');
    expect(ctx.alertCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'TAX_SYNC_FAILED',
          severity: 'CRITICAL',
        }),
      }),
    );
    expect(ctx.notificationsSend).toHaveBeenCalled();
  });

  it('holds filing until the org is production-active', async () => {
    const ctx = build('PENDING_KRA_APPROVAL');
    ctx.queueFindMany.mockResolvedValueOnce([makeEntry()] as never);

    const result = await ctx.service.processQueue(new Date());

    expect(result.held).toBe(1);
    expect(ctx.vscuSign).not.toHaveBeenCalled();
    expect(ctx.vscuTransmit).not.toHaveBeenCalled();
    expect(ctx.queueUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastError: expect.stringContaining('production'),
        }),
      }),
    );
  });

  it('keeps per-org order by halting an org after the first failure', async () => {
    const ctx = build('PRODUCTION_ACTIVE');
    const first = makeEntry({
      signedAt: new Date(),
      vscuReceiptNumber: '1',
      vscuInternalData: 'i',
      vscuReceiptSignature: 's',
    });
    const second = {
      ...makeEntry({
        id: 'rec_2',
        signedAt: new Date(),
        vscuReceiptNumber: '2',
        vscuInternalData: 'i2',
        vscuReceiptSignature: 's2',
      }),
      id: 'q_2',
      taxInvoiceRecordId: 'rec_2',
    };
    ctx.queueFindMany.mockResolvedValueOnce([first, second] as never);
    ctx.vscuTransmit.mockRejectedValueOnce(new VscuApiError('boom', '500'));

    const result = await ctx.service.processQueue(new Date());

    expect(result.processed).toBe(1);
    expect(ctx.vscuTransmit).toHaveBeenCalledTimes(1);
  });
});
