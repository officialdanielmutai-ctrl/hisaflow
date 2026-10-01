import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AlertSeverity,
  AlertStatus,
  AlertType,
  Prisma,
  TaxInvoiceStatus,
  TaxSyncErrorClass,
  TaxSyncStatus,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { VscuClient } from './vscu/vscu.client';
import { VscuApiError, VscuConnectionError } from './vscu/vscu.errors';
import {
  VscuLineItem,
  VscuSignInput,
  VscuTransmitInput,
} from './vscu/vscu.types';
import { isEtimsProductionActive } from './tax-registration.service';
import { calculateInclusiveTax } from './tax-calculator';

/**
 * Backoff schedules, mirroring the RouterAction/PaymentAttempt discipline
 * (bounded attempts, attempt count + lastError on the row, resolvedAt on
 * success) rather than inventing a fourth retry convention.
 *
 * Device-offline retries are short; KRA error responses back off longer
 * because a KRA-side outage is a different, more urgent problem.
 */
export const NETWORK_BACKOFF_MS = [5 * 60_000, 15 * 60_000, 3_600_000, 6 * 3_600_000];
export const KRA_ERROR_BACKOFF_MS = [15 * 60_000, 3_600_000, 6 * 3_600_000, 12 * 3_600_000];
/** While an org is not production-active, wait a day before re-checking. */
export const HOLD_UNTIL_PRODUCTION_MS = 24 * 3_600_000;

type SyncOutcome = 'synced' | 'offline' | 'kra_error' | 'held';

type QueueEntry = Prisma.TaxSyncQueueGetPayload<{
  include: {
    taxInvoiceRecord: {
      include: { invoice: { include: { lineItems: true } } };
    };
  };
}>;

export interface TaxSyncRunResult {
  processed: number;
  synced: number;
  offline: number;
  kraErrors: number;
  held: number;
}

export interface TaxSyncStatusView {
  pending: number;
  synced: number;
  failed: number;
  oldestPendingAt: Date | null;
  lastSyncedAt: Date | null;
  items: {
    invoiceId: string;
    status: TaxSyncStatus;
    signed: boolean;
    attempts: number;
    kraErrorCount: number;
    nextAttemptAt: Date | null;
    lastError: string | null;
    lastErrorClass: TaxSyncErrorClass | null;
    enqueuedAt: Date;
  }[];
}

/**
 * Phase C — the offline sync loop. Signs queued invoices through the local
 * VSCU (offline-capable) and transmits them to KRA in order, applying the
 * Section 7 item 4 failure-mode split:
 *
 * - `VscuConnectionError` on transmission = device offline → keep queued,
 *   bounded backoff, no alert (retry silently when connectivity returns).
 * - `VscuApiError` = a real KRA error response → backoff, `kraErrorCount`, and
 *   an unresolved `TAX_SYNC_FAILED` alert so the team sees a KRA-side problem.
 *
 * Processing is per-org in `enqueuedAt` order and halts that org on the first
 * failure, so receipts stay sequential.
 */
@Injectable()
export class TaxSyncService {
  private readonly logger = new Logger(TaxSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vscu: VscuClient,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async processQueue(now = new Date()): Promise<TaxSyncRunResult> {
    const entries = await this.prisma.db.taxSyncQueue.findMany({
      where: {
        status: TaxSyncStatus.PENDING,
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      orderBy: { enqueuedAt: 'asc' },
      include: {
        taxInvoiceRecord: {
          include: { invoice: { include: { lineItems: true } } },
        },
      },
    });

    const result: TaxSyncRunResult = {
      processed: 0,
      synced: 0,
      offline: 0,
      kraErrors: 0,
      held: 0,
    };
    const haltedOrgs = new Set<string>();

    for (const entry of entries) {
      if (haltedOrgs.has(entry.organizationId)) continue;

      result.processed += 1;
      const outcome = await this.processEntry(entry, now);

      switch (outcome) {
        case 'synced':
          result.synced += 1;
          break;
        case 'offline':
          result.offline += 1;
          haltedOrgs.add(entry.organizationId);
          break;
        case 'kra_error':
          result.kraErrors += 1;
          haltedOrgs.add(entry.organizationId);
          break;
        case 'held':
          result.held += 1;
          break;
      }
    }

    return result;
  }

  /** Read model for the (Phase D) Tax tab / any sync-status indicator. */
  async getStatus(organizationId: string): Promise<TaxSyncStatusView> {
    const queue = await this.prisma.db.taxSyncQueue.findMany({
      where: { organizationId },
      orderBy: { enqueuedAt: 'desc' },
      take: 100,
      include: {
        taxInvoiceRecord: {
          select: { invoiceId: true, signedAt: true, syncedAt: true },
        },
      },
    });

    const pending = queue.filter((q) => q.status === TaxSyncStatus.PENDING);
    const oldestPendingAt = pending.reduce<Date | null>(
      (oldest, q) => (!oldest || q.enqueuedAt < oldest ? q.enqueuedAt : oldest),
      null,
    );
    const syncedAt = queue
      .map((q) => q.resolvedAt)
      .filter((d): d is Date => Boolean(d));
    const lastSyncedAt = syncedAt.length
      ? new Date(Math.max(...syncedAt.map((d) => d.getTime())))
      : null;

    return {
      pending: pending.length,
      synced: queue.filter((q) => q.status === TaxSyncStatus.SYNCED).length,
      failed: queue.filter((q) => q.status === TaxSyncStatus.FAILED).length,
      oldestPendingAt,
      lastSyncedAt,
      items: queue.map((q) => ({
        invoiceId: q.taxInvoiceRecord.invoiceId,
        status: q.status,
        signed: Boolean(q.taxInvoiceRecord.signedAt),
        attempts: q.attempts,
        kraErrorCount: q.kraErrorCount,
        nextAttemptAt: q.nextAttemptAt,
        lastError: q.lastError,
        lastErrorClass: q.lastErrorClass,
        enqueuedAt: q.enqueuedAt,
      })),
    };
  }

  // ── One queue entry ──────────────────────────────────────────────────────

  private async processEntry(
    entry: QueueEntry,
    now: Date,
  ): Promise<SyncOutcome> {
    const registration = await this.prisma.db.taxRegistration.findUnique({
      where: { organizationId: entry.organizationId },
    });

    // No live filing before KRA approves production (Phase A's gate).
    if (!registration || !isEtimsProductionActive(registration.status)) {
      await this.prisma.db.taxSyncQueue.update({
        where: { id: entry.id },
        data: {
          nextAttemptAt: new Date(now.getTime() + HOLD_UNTIL_PRODUCTION_MS),
          lastError: 'Awaiting production eTIMS registration',
        },
      });
      return 'held';
    }

    const record = entry.taxInvoiceRecord;
    const invoice = record.invoice;
    const input = this.buildSignInput(registration.kraPin, record, invoice, now);

    let receiptNumber = record.vscuReceiptNumber;
    let internalData = record.vscuInternalData;
    let receiptSignature = record.vscuReceiptSignature;

    if (!record.signedAt) {
      try {
        const signature = await this.vscu.sign(input);
        await this.prisma.db.taxInvoiceRecord.update({
          where: { id: record.id },
          data: {
            vscuReceiptNumber: signature.receiptNumber,
            vscuInternalData: signature.internalData,
            vscuReceiptSignature: signature.receiptSignature,
            signedAt: now,
            lastError: null,
          },
        });
        receiptNumber = signature.receiptNumber;
        internalData = signature.internalData;
        receiptSignature = signature.receiptSignature;
      } catch (err) {
        if (err instanceof VscuConnectionError || err instanceof VscuApiError) {
          // The local bridge is down/errored — a real problem, not "offline".
          await this.recordFailure(
            entry,
            now,
            err,
            TaxSyncErrorClass.LOCAL_VSCU_ERROR,
          );
          return 'kra_error';
        }
        throw err;
      }
    }

    const transmitInput: VscuTransmitInput = {
      ...input,
      receiptNumber: receiptNumber ?? '',
      internalData: internalData ?? '',
      receiptSignature: receiptSignature ?? '',
    };

    try {
      const result = await this.vscu.transmit(transmitInput);
      await this.markSynced(entry, result.kraInvoiceNumber, now);
      return 'synced';
    } catch (err) {
      if (err instanceof VscuConnectionError) {
        // Device offline: queue silently and retry on reconnect.
        await this.recordFailure(
          entry,
          now,
          err,
          TaxSyncErrorClass.NETWORK_OFFLINE,
        );
        return 'offline';
      }
      if (err instanceof VscuApiError) {
        // A real error response from KRA: backoff + alert.
        await this.recordFailure(entry, now, err, TaxSyncErrorClass.KRA_ERROR);
        return 'kra_error';
      }
      throw err;
    }
  }

  private async recordFailure(
    entry: QueueEntry,
    now: Date,
    err: Error,
    errorClass: TaxSyncErrorClass,
  ): Promise<void> {
    const offline = errorClass === TaxSyncErrorClass.NETWORK_OFFLINE;
    const attempts = offline ? entry.attempts + 1 : entry.attempts;
    const kraErrorCount = offline
      ? entry.kraErrorCount
      : entry.kraErrorCount + 1;
    const schedule = offline ? NETWORK_BACKOFF_MS : KRA_ERROR_BACKOFF_MS;
    const step = Math.max(0, (offline ? attempts : kraErrorCount) - 1);
    const delay = schedule[Math.min(step, schedule.length - 1)];

    await this.prisma.db.$transaction([
      this.prisma.db.taxSyncQueue.update({
        where: { id: entry.id },
        data: {
          attempts,
          kraErrorCount,
          lastAttemptAt: now,
          nextAttemptAt: new Date(now.getTime() + delay),
          lastError: err.message,
          lastErrorClass: errorClass,
        },
      }),
      this.prisma.db.taxInvoiceRecord.update({
        where: { id: entry.taxInvoiceRecordId },
        data: { lastError: err.message },
      }),
    ]);

    if (offline) {
      this.logger.warn(
        `eTIMS transmit offline for record ${entry.taxInvoiceRecordId}; retry in ${Math.round(delay / 60_000)}m`,
      );
      return;
    }

    await this.raiseSyncAlert(entry.organizationId, err.message);
    this.logger.error(
      `eTIMS ${errorClass} for record ${entry.taxInvoiceRecordId}: ${err.message}`,
    );
  }

  private async markSynced(
    entry: QueueEntry,
    kraInvoiceNumber: string,
    now: Date,
  ): Promise<void> {
    await this.prisma.db.$transaction([
      this.prisma.db.taxInvoiceRecord.update({
        where: { id: entry.taxInvoiceRecordId },
        data: {
          status: TaxInvoiceStatus.SYNCED,
          kraInvoiceNumber,
          syncedAt: now,
          lastError: null,
        },
      }),
      this.prisma.db.taxSyncQueue.update({
        where: { id: entry.id },
        data: {
          status: TaxSyncStatus.SYNCED,
          resolvedAt: now,
          nextAttemptAt: null,
          lastError: null,
          lastErrorClass: null,
        },
      }),
      this.prisma.db.alert.updateMany({
        where: {
          organizationId: entry.organizationId,
          type: AlertType.TAX_SYNC_FAILED,
          status: AlertStatus.UNRESOLVED,
        },
        data: { status: AlertStatus.RESOLVED, resolvedAt: now },
      }),
    ]);
  }

  /** One unresolved alert per org, refreshed with the latest error. */
  private async raiseSyncAlert(
    organizationId: string,
    message: string,
  ): Promise<void> {
    const existing = await this.prisma.db.alert.findFirst({
      where: {
        organizationId,
        type: AlertType.TAX_SYNC_FAILED,
        status: AlertStatus.UNRESOLVED,
      },
    });

    const description = `KRA rejected an eTIMS tax invoice: ${message}`;

    if (existing) {
      await this.prisma.db.alert.update({
        where: { id: existing.id },
        data: { description },
      });
      return;
    }

    await this.prisma.db.alert.create({
      data: {
        organizationId,
        itemId: null,
        type: AlertType.TAX_SYNC_FAILED,
        severity: AlertSeverity.CRITICAL,
        title: 'eTIMS filing failed',
        description,
      },
    });

    await this.notifications
      .sendPushToOrganization(organizationId, {
        title: 'eTIMS filing failed',
        body: 'A tax invoice could not be filed with KRA. Open Tax to review.',
        url: '/tax',
      })
      .catch(() => undefined);
  }

  private buildSignInput(
    kraPin: string,
    record: QueueEntry['taxInvoiceRecord'],
    invoice: QueueEntry['taxInvoiceRecord']['invoice'],
    now: Date,
  ): VscuSignInput {
    const taxRate = Number(record.taxRate);
    const lineItems: VscuLineItem[] = invoice.lineItems.map((line) => ({
      description: line.description,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      netAmount: Number(line.netAmount),
      taxAmount: Number(line.taxAmount),
      taxRate: Number(line.taxRate),
    }));

    // Room/consumption charges are not itemised rows; add them as one line so
    // the VSCU payload totals match the invoice.
    const itemisedGross = lineItems.reduce(
      (sum, line) => sum + line.unitPrice * line.quantity,
      0,
    );
    const nonItemisedGross = round2(Number(record.grossAmount) - itemisedGross);
    if (nonItemisedGross > 0.005) {
      const split = calculateInclusiveTax(nonItemisedGross, taxRate);
      lineItems.push({
        description: 'Accommodation / other charges',
        quantity: 1,
        unitPrice: nonItemisedGross,
        netAmount: Number(split.netAmount),
        taxAmount: Number(split.taxAmount),
        taxRate,
      });
    }

    return {
      organizationId: record.organizationId,
      invoiceId: record.invoiceId,
      invoiceNumber: record.invoiceId,
      tin: kraPin,
      branchId: this.config.get<string>('etims.branchId') || '00',
      saleDate: invoice.issuedAt ?? invoice.createdAt ?? now,
      currency: record.currency,
      lineItems,
      netAmount: Number(record.netAmount),
      taxAmount: Number(record.taxAmount),
      grossAmount: Number(record.grossAmount),
    };
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
