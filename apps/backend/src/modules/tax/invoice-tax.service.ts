import { Injectable } from '@nestjs/common';
import {
  Invoice,
  InvoiceLineItem,
  Prisma,
} from '@prisma/client';
import { TaxDbClient } from './tax-client';
import { TaxFilingService } from './tax-filing.service';
import {
  calculateInclusiveTax,
  KENYA_STANDARD_VAT_RATE,
  toDecimal,
} from './tax-calculator';

/**
 * The subset of the Prisma client the tax-aware invoice factory needs. Both
 * `PrismaClient` and a `$transaction` client satisfy it.
 */
export type InvoiceTaxClient = TaxDbClient;

/**
 * Phase B — the single choke point for creating `Invoice` / `InvoiceLineItem`
 * rows. Every invoice and line item is created through here, so tax is
 * calculated automatically for a tax-registered org and cannot be forgotten.
 *
 * This is enforced two ways:
 *  1. callers (InvoicesService, IspInvoicesService, EquipmentService) have no
 *     other way to create these rows; and
 *  2. `invoice-tax-enforcement.spec.ts` fails the suite if a raw
 *     `invoice.create` / `invoiceLineItem.create` reappears anywhere else.
 *
 * Calculation is standard VAT only (Section 7 item 3); no regime branching.
 */
@Injectable()
export class InvoiceTaxService {
  constructor(private readonly taxFiling: TaxFilingService) {}

  /**
   * Create an invoice with its `taxTotal` computed from the (tax-inclusive)
   * room/consumption/adjustments totals. Non-registered orgs get taxTotal = 0.
   */
  async createInvoice(
    client: InvoiceTaxClient,
    args: {
      data: Prisma.InvoiceUncheckedCreateInput;
      include?: Prisma.InvoiceInclude;
    },
  ): Promise<Invoice> {
    const rate = await this.resolveRate(client, args.data.organizationId);
    const base = toDecimal(args.data.roomTotal)
      .plus(toDecimal(args.data.consumptionTotal))
      .plus(toDecimal(args.data.adjustmentsTotal));
    const taxTotal = rate.isZero()
      ? new Prisma.Decimal(0)
      : calculateInclusiveTax(base, rate).taxAmount;

    const invoice = await client.invoice.create({
      data: { ...args.data, taxTotal },
      include: args.include,
    });

    // Phase C: a tax-registered org's invoice is recorded for eTIMS filing at
    // the same choke point, so it cannot skip the offline queue.
    if (!rate.isZero()) {
      await this.taxFiling.ensureRecord(client, invoice.id);
    }

    return invoice;
  }

  /**
   * Create a line item with its net/tax split, and keep the parent invoice's
   * cached totals consistent (`adjustmentsTotal` and `taxTotal`).
   *
   * Callers must NOT increment `adjustmentsTotal` themselves any more.
   */
  async createLineItem(
    client: InvoiceTaxClient,
    data: Prisma.InvoiceLineItemUncheckedCreateInput,
  ): Promise<InvoiceLineItem> {
    const invoice = await client.invoice.findUniqueOrThrow({
      where: { id: data.invoiceId },
      select: {
        organizationId: true,
        roomTotal: true,
        consumptionTotal: true,
      },
    });

    const rate = await this.resolveRate(client, invoice.organizationId);
    const { netAmount, taxAmount, taxRate } = calculateInclusiveTax(
      data.total,
      rate,
    );

    const lineItem = await client.invoiceLineItem.create({
      data: { ...data, netAmount, taxAmount, taxRate },
    });

    const nonItemisedBase = toDecimal(invoice.roomTotal).plus(
      toDecimal(invoice.consumptionTotal),
    );
    await client.invoice.update({
      where: { id: data.invoiceId },
      data: {
        adjustmentsTotal: { increment: data.total },
        taxTotal: await this.taxTotalFor(
          client,
          data.invoiceId,
          nonItemisedBase,
          rate,
        ),
      },
    });

    if (!rate.isZero()) {
      await this.taxFiling.ensureRecord(client, data.invoiceId);
    }

    return lineItem;
  }

  /** Recompute and return the tax contained in an invoice's current totals. */
  async recomputeTaxTotal(
    client: InvoiceTaxClient,
    invoiceId: string,
  ): Promise<Prisma.Decimal> {
    const invoice = await client.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      select: {
        organizationId: true,
        roomTotal: true,
        consumptionTotal: true,
      },
    });
    const rate = await this.resolveRate(client, invoice.organizationId);
    const nonItemisedBase = toDecimal(invoice.roomTotal).plus(
      toDecimal(invoice.consumptionTotal),
    );
    return this.taxTotalFor(client, invoiceId, nonItemisedBase, rate);
  }

  /** Is there a KRA eTIMS registration for this org? */
  async isTaxRegistered(
    client: InvoiceTaxClient,
    organizationId: string,
  ): Promise<boolean> {
    const registration = await client.taxRegistration.findUnique({
      where: { organizationId },
      select: { id: true },
    });
    return Boolean(registration);
  }

  // ── Internals ────────────────────────────────────────────────────────────

  /** Standard VAT for a registered org, otherwise zero. */
  private async resolveRate(
    client: InvoiceTaxClient,
    organizationId: string,
  ): Promise<Prisma.Decimal> {
    const registered = await this.isTaxRegistered(client, organizationId);
    return registered
      ? new Prisma.Decimal(KENYA_STANDARD_VAT_RATE)
      : new Prisma.Decimal(0);
  }

  /**
   * Invoice tax = tax on the non-itemised base (room + consumption) plus the
   * sum of the itemised lines' stored tax, so the invoice total always equals
   * the line-level truth rather than re-rounding the aggregate.
   */
  private async taxTotalFor(
    client: InvoiceTaxClient,
    invoiceId: string,
    nonItemisedBase: Prisma.Decimal,
    rate: Prisma.Decimal,
  ): Promise<Prisma.Decimal> {
    if (rate.isZero()) return new Prisma.Decimal(0);

    const aggregate = await client.invoiceLineItem.aggregate({
      where: { invoiceId },
      _sum: { taxAmount: true },
    });
    const baseTax = calculateInclusiveTax(nonItemisedBase, rate).taxAmount;
    return baseTax.plus(aggregate._sum.taxAmount ?? 0);
  }
}
