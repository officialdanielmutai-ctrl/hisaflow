import {
  getCategoryLabel,
  type FinanceAttribute,
  type FinanceAttributeType,
} from '@/services/business-finance.service';

export interface FinanceAttributeMeta {
  label: string;
  emoji: string;
  badge: string;
}

/** Presentation metadata for each searchable finance attribute type. */
export const FINANCE_ATTRIBUTE_META: Record<FinanceAttributeType, FinanceAttributeMeta> = {
  REVENUE: { label: 'Revenue', emoji: '💰', badge: 'bg-emerald-100 text-emerald-700' },
  EXPENSE: { label: 'Expense', emoji: '💸', badge: 'bg-red-100 text-red-700' },
  LEAK: { label: 'Leak', emoji: '⚠️', badge: 'bg-amber-100 text-amber-700' },
  CREDIT: { label: 'Credit', emoji: '💳', badge: 'bg-blue-100 text-blue-700' },
  LEDGER: {
    label: 'Ledger',
    emoji: '📒',
    badge: 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]',
  },
};

/**
 * Expense and ledger labels are stored as category codes (RENT, SALARY…) while
 * room/service labels are already human. `getCategoryLabel` passes unknown
 * values through unchanged, so this is safe for both.
 */
export function financeAttributeTitle(attribute: FinanceAttribute): string {
  if (attribute.type === 'EXPENSE' || attribute.type === 'LEDGER') {
    return getCategoryLabel(attribute.label);
  }
  return attribute.label;
}
