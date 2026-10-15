import { describe, it, expect } from 'vitest';
import type { FinanceAttribute } from '@/services/business-finance.service';
import { FINANCE_ATTRIBUTE_META, financeAttributeTitle } from './finance-search';

function attribute(overrides: Partial<FinanceAttribute>): FinanceAttribute {
  return {
    id: 'a1',
    type: 'REVENUE',
    label: 'Room 1',
    subtitle: null,
    amount: 0,
    sharePct: null,
    detail: null,
    ...overrides,
  };
}

describe('finance attribute presentation', () => {
  it('maps category codes to human labels for expenses and ledger entries', () => {
    expect(financeAttributeTitle(attribute({ type: 'EXPENSE', label: 'RENT' }))).toBe('Rent');
    expect(financeAttributeTitle(attribute({ type: 'LEDGER', label: 'SALARY' }))).toBe('Salary');
  });

  it('passes room, plan and class names through unchanged', () => {
    expect(financeAttributeTitle(attribute({ type: 'REVENUE', label: 'Room 3' }))).toBe('Room 3');
    expect(financeAttributeTitle(attribute({ type: 'REVENUE', label: 'Form 1' }))).toBe('Form 1');
  });

  it('has display metadata for every attribute type', () => {
    for (const type of ['REVENUE', 'EXPENSE', 'LEAK', 'CREDIT', 'LEDGER'] as const) {
      expect(FINANCE_ATTRIBUTE_META[type].label).toBeTruthy();
      expect(FINANCE_ATTRIBUTE_META[type].emoji).toBeTruthy();
    }
  });
});
