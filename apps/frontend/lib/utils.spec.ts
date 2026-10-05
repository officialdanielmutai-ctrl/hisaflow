import { describe, it, expect } from 'vitest';
import { cn, formatCurrency } from './utils';

describe('formatCurrency', () => {
  it('formats KES by default with thousands separators', () => {
    const formatted = formatCurrency(1234.5);

    expect(formatted).toContain('1,234.5');
    expect(formatted).toMatch(/Ksh|KES/);
  });

  it('honours an explicit currency', () => {
    expect(formatCurrency(-12.34, 'USD')).toBe('-US$12.34');
  });

  it('formats zero without a sign', () => {
    const formatted = formatCurrency(0);

    expect(formatted).toContain('0');
    expect(formatted).not.toContain('-');
  });
});

describe('cn', () => {
  it('merges conflicting tailwind classes, last one wins', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('drops falsy values', () => {
    expect(cn('text-sm', false && 'hidden', undefined, 'font-bold')).toBe('text-sm font-bold');
  });
});
