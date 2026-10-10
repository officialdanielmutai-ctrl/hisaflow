import { describe, it, expect } from 'vitest';
import { formatGrouped, formatKpiNumber } from './kpi-format';

describe('kpi number formatting', () => {
  it('groups thousands in the full value', () => {
    expect(formatGrouped(48350)).toBe('48,350');
    expect(formatGrouped(0)).toBe('0');
    expect(formatGrouped(-2500)).toBe('-2,500');
  });

  it('keeps values below the threshold in full', () => {
    const result = formatKpiNumber(48_350);
    expect(result.display).toBe('48,350');
    expect(result.full).toBe('48,350');
  });

  it('compacts large values but keeps the full value available', () => {
    const result = formatKpiNumber(1_200_000);
    expect(result.display).toMatch(/^1\.2M$/);
    expect(result.full).toBe('1,200,000');
  });

  it('honours a custom compact threshold', () => {
    const result = formatKpiNumber(48_350, { compactFrom: 10_000 });
    expect(result.display).toMatch(/48\.4K/);
    expect(result.full).toBe('48,350');
  });
});
