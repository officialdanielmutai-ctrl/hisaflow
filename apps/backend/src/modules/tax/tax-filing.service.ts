import { Injectable } from '@nestjs/common';
import { Prisma, TaxInvoiceRecord, TaxInvoiceStatus } from '@prisma/client';
import { TaxDbClient } from './tax-client';
import { toDecimal } from './tax-calculator';

/**
 * Creates/refreshes the tax-filing record and offline queue entry for an
 * invoice. Deliberately DB-only — it runs inside the caller's transaction, so
 * it must never do network I/O. Signing/transmission is the sync job's job.
 *
 * Called automatically from `InvoiceTaxService`, which is the only place
 * `Invoice` / `InvoiceLineItem` rows are created, so a tax-registered org's
 * invoice cannot skip filing.
 */
@Injectable()
export class TaxFilingService {
  async ensureRecord(
    client: TaxDbClient,
    invoiceId: string,
  ): Promise<TaxInvoiceRecord | null> {
    const invoice = await client.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { lineItems: true },
    });

    const grossAmount = toDecimal(invoice.roomTotal)
      .plus(toDecimal(invoice.consumptionTotal))
      .plus(toDecimal(invoice.adjustmentsTotal));
    const taxAmount = toDecimal(invoice.taxTotal);
    const netAmount = grossAmount.minus(taxAmount);

    const existing = await client.taxInvoiceRecord.findUnique({
      where: { invoiceId },
    });

    // No tax and never filed — nothing to record (a non-registered org).
    if (taxAmount.isZero() && !existing) {
      return null;
    }

    const taxRate = netAmount.gt(0)
      ? taxAmount.div(netAmount).toDecimalPlaces(4)
      : new Prisma.Decimal(0);

    const record = await client.taxInvoiceRecord.upsert({
      where: { invoiceId },
      // Never clobber status/signature/sync fields — only the money.
      update: {
        organizationId: invoice.organizationId,
        netAmount,
        taxAmount,
        grossAmount,
        taxRate,
      },
      create: {
        invoiceId,
        organizationId: invoice.organizationId,
        netAmount,
        taxAmount,
        grossAmount,
        taxRate,
      },
    });

    // A signed/SYNCED record does not need re-queueing.
    if (record.status !== TaxInvoiceStatus.SYNCED) {
      await client.taxSyncQueue.upsert({
        where: { taxInvoiceRecordId: record.id },
        update: {},
        create: {
          organizationId: invoice.organizationId,
          taxInvoiceRecordId: record.id,
        },
      });
    }

    return record;
  }
}
