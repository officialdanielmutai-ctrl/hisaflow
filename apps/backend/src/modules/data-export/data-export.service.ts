import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';

export const EXPORT_DATASETS = [
  'inventory',
  'transactions',
  'invoices',
  'fee-invoices',
  'credit',
  'tax',
] as const;

export type ExportDataset = (typeof EXPORT_DATASETS)[number];

export function isExportDataset(value: string): value is ExportDataset {
  return (EXPORT_DATASETS as readonly string[]).includes(value);
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw =
    value instanceof Date
      ? value.toISOString()
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);
  return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join(
    '\n',
  );
}

@Injectable()
export class DataExportService {
  constructor(private readonly prisma: PrismaService) {}

  async build(dataset: string, organizationId: string) {
    switch (dataset) {
      case 'inventory':
        return this.inventory(organizationId);
      case 'transactions':
        return this.transactions(organizationId);
      case 'invoices':
        return this.invoices(organizationId);
      case 'fee-invoices':
        return this.feeInvoices(organizationId);
      case 'credit':
        return this.credit(organizationId);
      case 'tax':
        return this.tax(organizationId);
      default:
        throw new BadRequestException(`Unknown export dataset: ${dataset}`);
    }
  }

  private async inventory(organizationId: string) {
    const items = await this.prisma.db.inventoryItem.findMany({
      where: { organizationId },
      include: { product: { select: { name: true } } },
      orderBy: [{ product: { name: 'asc' } }, { name: 'asc' }],
    });

    return {
      filename: 'inventory.csv',
      csv: toCsv(
        [
          'item_id',
          'product',
          'variant',
          'barcode',
          'unit',
          'quantity',
          'reorder_threshold',
          'cost_price',
          'selling_price',
          'status',
          'expiry_date',
          'batch_number',
          'is_active',
          'created_at',
        ],
        items.map((item) => [
          item.id,
          item.product?.name ?? '',
          item.name,
          item.barcode,
          item.unit,
          Number(item.quantity),
          item.reorderThreshold === null ? '' : Number(item.reorderThreshold),
          item.costPrice === null ? '' : Number(item.costPrice),
          item.sellingPrice === null ? '' : Number(item.sellingPrice),
          item.status,
          item.expiryDate,
          item.batchNumber,
          item.isActive,
          item.createdAt,
        ]),
      ),
    };
  }

  private async transactions(organizationId: string) {
    const rows = await this.prisma.db.inventoryTransaction.findMany({
      where: { organizationId },
      include: { item: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      filename: 'stock-and-sales-ledger.csv',
      csv: toCsv(
        [
          'transaction_id',
          'created_at',
          'type',
          'item',
          'quantity_before',
          'quantity_change',
          'quantity_after',
          'reason',
          'client_name',
          'actor_id',
          'source',
        ],
        rows.map((row) => [
          row.id,
          row.createdAt,
          row.type,
          row.item?.name ?? '',
          Number(row.quantityBefore),
          Number(row.quantityChange),
          Number(row.quantityAfter),
          row.reason,
          row.clientName,
          row.actorId,
          row.source,
        ]),
      ),
    };
  }

  private async invoices(organizationId: string) {
    const rows = await this.prisma.db.invoice.findMany({
      where: { organizationId },
      include: { booking: { include: { guest: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      filename: 'invoices.csv',
      csv: toCsv(
        [
          'invoice_id',
          'created_at',
          'status',
          'guest',
          'room_total',
          'consumption_total',
          'adjustments_total',
          'tax_total',
          'amount_paid',
          'balance',
          'issued_at',
          'due_date',
        ],
        rows.map((row) => {
          const total =
            Number(row.roomTotal) +
            Number(row.consumptionTotal) +
            Number(row.adjustmentsTotal);
          return [
            row.id,
            row.createdAt,
            row.status,
            row.booking?.guest?.name ?? '',
            Number(row.roomTotal),
            Number(row.consumptionTotal),
            Number(row.adjustmentsTotal),
            Number(row.taxTotal),
            Number(row.amountPaid),
            total - Number(row.amountPaid),
            row.issuedAt,
            row.dueDate,
          ];
        }),
      ),
    };
  }

  private async feeInvoices(organizationId: string) {
    const rows = await this.prisma.db.feeInvoice.findMany({
      where: { organizationId },
      include: {
        student: { select: { name: true, admissionNumber: true } },
        term: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      filename: 'school-fee-invoices.csv',
      csv: toCsv(
        [
          'invoice_id',
          'created_at',
          'status',
          'student',
          'admission_number',
          'term',
          'total_expected',
          'adjustments_total',
          'amount_paid',
          'balance',
          'issued_at',
          'due_date',
        ],
        rows.map((row) => {
          const expected =
            Number(row.totalExpected) - Number(row.adjustmentsTotal);
          return [
            row.id,
            row.createdAt,
            row.status,
            row.student?.name ?? '',
            row.student?.admissionNumber ?? '',
            row.term?.name ?? '',
            expected,
            Number(row.adjustmentsTotal),
            Number(row.amountPaid),
            expected - Number(row.amountPaid),
            row.issuedAt,
            row.dueDate,
          ];
        }),
      ),
    };
  }

  private async credit(organizationId: string) {
    const rows = await this.prisma.db.creditRecord.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      filename: 'customer-credit.csv',
      csv: toCsv(
        [
          'credit_id',
          'created_at',
          'client_name',
          'amount_total',
          'amount_paid',
          'balance',
          'status',
          'due_date',
          'notes',
        ],
        rows.map((row) => [
          row.id,
          row.createdAt,
          row.clientName,
          Number(row.amountTotal),
          Number(row.amountPaid),
          Number(row.amountTotal) - Number(row.amountPaid),
          row.status,
          row.dueDate,
          row.notes,
        ]),
      ),
    };
  }

  private async tax(organizationId: string) {
    const rows = await this.prisma.db.taxInvoiceRecord.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      filename: 'tax-records.csv',
      csv: toCsv(
        [
          'record_id',
          'invoice_id',
          'created_at',
          'status',
          'currency',
          'net_amount',
          'tax_amount',
          'gross_amount',
          'tax_rate',
          'vscu_receipt_number',
          'kra_invoice_number',
          'signed_at',
          'synced_at',
          'last_error',
        ],
        rows.map((row) => [
          row.id,
          row.invoiceId,
          row.createdAt,
          row.status,
          row.currency,
          Number(row.netAmount),
          Number(row.taxAmount),
          Number(row.grossAmount),
          Number(row.taxRate),
          row.vscuReceiptNumber,
          row.kraInvoiceNumber,
          row.signedAt,
          row.syncedAt,
          row.lastError,
        ]),
      ),
    };
  }
}
