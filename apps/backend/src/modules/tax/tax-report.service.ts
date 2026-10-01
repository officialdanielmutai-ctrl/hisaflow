import { BadRequestException, Injectable } from '@nestjs/common';
import { TaxInvoiceStatus, TaxSyncStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma.service';
import { isEtimsProductionActive } from './tax-registration.service';

export interface TaxReportInvoice {
  invoiceId: string;
  invoiceStatus: string;
  currency: string;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
  taxRate: number;
  status: TaxInvoiceStatus;
  signed: boolean;
  signedAt: Date | null;
  syncedAt: Date | null;
  kraInvoiceNumber: string | null;
  vscuReceiptNumber: string | null;
  syncStatus: TaxSyncStatus | null;
  attempts: number;
  kraErrorCount: number;
  nextAttemptAt: Date | null;
  lastError: string | null;
  lastErrorClass: string | null;
  createdAt: Date;
}

export interface TaxReportView {
  registration: { status: string; canFileLive: boolean } | null;
  period: { from: Date; to: Date; label: string };
  summary: {
    filed: number;
    pending: number;
    failed: number;
    /** Taxable value / tax / gross of invoices KRA has confirmed this period. */
    taxableAmount: number;
    taxAmount: number;
    grossAmount: number;
    /** Tax that is signed/queued but not yet confirmed by KRA. */
    pendingTaxAmount: number;
  };
  invoices: TaxReportInvoice[];
  generatedAt: Date;
}

/**
 * Phase D read model — a strictly read-only picture of what has already been
 * calculated and filed automatically. It never writes, and the tab that
 * consumes it exposes no edit/manual-entry action (Section 1 core principle).
 */
@Injectable()
export class TaxReportService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(
    organizationId: string,
    range?: { from?: string; to?: string },
  ): Promise<TaxReportView> {
    const period = resolvePeriod(range);

    const [registration, records] = await Promise.all([
      this.prisma.db.taxRegistration.findUnique({
        where: { organizationId },
      }),
      this.prisma.db.taxInvoiceRecord.findMany({
        where: {
          organizationId,
          createdAt: { gte: period.from, lt: period.to },
          // Voided invoices are not a filing obligation.
          invoice: { status: { not: 'VOIDED' } },
        },
        orderBy: { createdAt: 'desc' },
        include: { syncQueue: true, invoice: { select: { status: true } } },
      }),
    ]);

    const summary = {
      filed: 0,
      pending: 0,
      failed: 0,
      taxableAmount: 0,
      taxAmount: 0,
      grossAmount: 0,
      pendingTaxAmount: 0,
    };

    const invoices: TaxReportInvoice[] = records.map((record) => {
      if (record.status === TaxInvoiceStatus.SYNCED) {
        summary.filed += 1;
        summary.taxableAmount += Number(record.netAmount);
        summary.taxAmount += Number(record.taxAmount);
        summary.grossAmount += Number(record.grossAmount);
      } else if (record.status === TaxInvoiceStatus.FAILED) {
        summary.failed += 1;
      } else {
        summary.pending += 1;
        summary.pendingTaxAmount += Number(record.taxAmount);
      }

      return {
        invoiceId: record.invoiceId,
        invoiceStatus: record.invoice.status,
        currency: record.currency,
        netAmount: Number(record.netAmount),
        taxAmount: Number(record.taxAmount),
        grossAmount: Number(record.grossAmount),
        taxRate: Number(record.taxRate),
        status: record.status,
        signed: Boolean(record.signedAt),
        signedAt: record.signedAt,
        syncedAt: record.syncedAt,
        kraInvoiceNumber: record.kraInvoiceNumber,
        vscuReceiptNumber: record.vscuReceiptNumber,
        syncStatus: record.syncQueue?.status ?? null,
        attempts: record.syncQueue?.attempts ?? 0,
        kraErrorCount: record.syncQueue?.kraErrorCount ?? 0,
        nextAttemptAt: record.syncQueue?.nextAttemptAt ?? null,
        lastError: record.syncQueue?.lastError ?? record.lastError,
        lastErrorClass: record.syncQueue?.lastErrorClass ?? null,
        createdAt: record.createdAt,
      };
    });

    return {
      registration: registration
        ? {
            status: registration.status,
            canFileLive: isEtimsProductionActive(registration.status),
          }
        : null,
      period,
      summary: {
        ...summary,
        taxableAmount: round2(summary.taxableAmount),
        taxAmount: round2(summary.taxAmount),
        grossAmount: round2(summary.grossAmount),
        pendingTaxAmount: round2(summary.pendingTaxAmount),
      },
      invoices,
      generatedAt: new Date(),
    };
  }
}

function resolvePeriod(range?: {
  from?: string;
  to?: string;
}): { from: Date; to: Date; label: string } {
  const now = new Date();
  let from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  let to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  if (range?.from) from = parseDate(range.from);
  if (range?.to) to = parseDate(range.to);

  if (from.getTime() >= to.getTime()) {
    throw new BadRequestException('Invalid period: from must be before to');
  }

  return {
    from,
    to,
    label: `${from.toLocaleString('en-KE', {
      month: 'long',
      timeZone: 'UTC',
    })} ${from.getUTCFullYear()}`,
  };
}

function parseDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid date: ${value}`);
  }
  return date;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
