import { Prisma } from '@prisma/client';

/**
 * Kenya's standard VAT rate. Per tax-system doc Section 7 item 3, Phase B
 * builds standard VAT as the baseline only — Turnover Tax / simplified regimes
 * are explicitly deferred, so there is deliberately no regime branching here.
 */
export const KENYA_STANDARD_VAT_RATE = 0.16;

/** Anything Prisma may hand back for a Decimal column, or a plain literal. */
export type DecimalInput =
  | Prisma.Decimal
  | Prisma.DecimalJsLike
  | number
  | string;

/** Coerce a Prisma Decimal-ish value (incl. DecimalJsLike) to a Decimal. */
export function toDecimal(
  value: DecimalInput | null | undefined,
): Prisma.Decimal {
  if (value === null || value === undefined) return new Prisma.Decimal(0);
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(value as Prisma.Decimal.Value);
}

export interface InclusiveTaxBreakdown {
  /** The tax-inclusive amount (what the customer pays). */
  grossAmount: Prisma.Decimal;
  /** The taxable value (gross minus tax). */
  netAmount: Prisma.Decimal;
  /** The tax component contained in the gross amount. */
  taxAmount: Prisma.Decimal;
  /** Rate applied, e.g. 0.1600. */
  taxRate: Prisma.Decimal;
}

/**
 * Extract the tax component from a tax-inclusive amount.
 *
 * Kenyan retail prices are quoted VAT-inclusive, so a line's existing `total`
 * (quantity × unitPrice) is treated as the gross the customer pays and the tax
 * is carved out of it rather than added on top. This keeps every existing
 * "amount due" calculation (payments, partial/paid status) unchanged.
 *
 * Zero rate (a non-tax-registered org) yields net = gross and tax = 0.
 */
export function calculateInclusiveTax(
  grossAmount: DecimalInput,
  rate: DecimalInput = KENYA_STANDARD_VAT_RATE,
): InclusiveTaxBreakdown {
  const gross = toDecimal(grossAmount).toDecimalPlaces(2);
  const taxRate = toDecimal(rate);

  if (taxRate.isZero()) {
    return {
      grossAmount: gross,
      netAmount: gross,
      taxAmount: new Prisma.Decimal(0),
      taxRate,
    };
  }

  const netAmount = gross.div(taxRate.plus(1)).toDecimalPlaces(2);
  const taxAmount = gross.minus(netAmount);

  return { grossAmount: gross, netAmount, taxAmount, taxRate };
}
