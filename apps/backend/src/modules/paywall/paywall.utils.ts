/**
 * Shared helpers for the HisaFlow paywall/billing module.
 *
 * Amounts: Paystack takes the smallest currency unit (KES cents), while
 * HisaflowPlan/PaymentAttempt store KES as a Decimal. Keeping the conversion in
 * one place avoids the classic 100x billing bug.
 */
export function toSubunit(
  amount: { toString(): string } | number | string,
): number {
  return Math.round(Number(amount) * 100);
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  const targetMonth = next.getMonth() + months;
  next.setMonth(targetMonth);
  return next;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}
