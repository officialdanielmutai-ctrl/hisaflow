import { Prisma } from '@prisma/client';
import {
  calculateInclusiveTax,
  KENYA_STANDARD_VAT_RATE,
  toDecimal,
} from './tax-calculator';

describe('tax-calculator (Phase B — standard VAT baseline)', () => {
  it('extracts 16% VAT from a tax-inclusive gross amount', () => {
    const result = calculateInclusiveTax(1160);

    expect(result.netAmount.toString()).toBe('1000');
    expect(result.taxAmount.toString()).toBe('160');
    expect(result.taxRate.toString()).toBe('0.16');
    expect(result.grossAmount.toString()).toBe('1160');
  });

  it('rounds net/tax to 2 decimal places', () => {
    const result = calculateInclusiveTax(2500);

    expect(result.netAmount.toString()).toBe('2155.17');
    expect(result.taxAmount.toString()).toBe('344.83');
    // net + tax must reconcile exactly to gross
    expect(result.netAmount.plus(result.taxAmount).toString()).toBe('2500');
  });

  it('uses the default rate when none is supplied', () => {
    expect(toDecimal(KENYA_STANDARD_VAT_RATE).toString()).toBe('0.16');
  });

  it('leaves the amount untouched at a zero rate (non-registered org)', () => {
    const result = calculateInclusiveTax(1000, 0);

    expect(result.grossAmount.toString()).toBe('1000');
    expect(result.netAmount.toString()).toBe('1000');
    expect(result.taxAmount.toString()).toBe('0');
  });

  it('handles fractional line totals without losing cents', () => {
    // quantity 3.5 × unitPrice 199.99 = 699.965 → gross rounded to 699.97
    const result = calculateInclusiveTax('699.965');

    expect(result.grossAmount.toString()).toBe('699.97');
    expect(result.netAmount.toString()).toBe('603.42');
    expect(result.taxAmount.toString()).toBe('96.55');
  });

  it('coerces Prisma Decimal-ish and null inputs', () => {
    expect(toDecimal(null).toString()).toBe('0');
    expect(toDecimal(undefined).toString()).toBe('0');
    expect(toDecimal(new Prisma.Decimal('500.00')).toString()).toBe('500');
    expect(toDecimal('123.45').toString()).toBe('123.45');
  });
});
