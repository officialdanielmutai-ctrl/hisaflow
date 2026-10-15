import { apiGet, apiPost, apiDelete, apiPatch } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BusinessTransactionRecord {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  description: string | null;
  staffName: string | null;
  date: string;
  isRecurring: boolean;
  recurrenceRule: string | null;
  createdAt: string;
}

export interface ExpenseCategoryBreakdown {
  category: string;
  total: number;
  count: number;
}

export interface DailyFinancialPoint {
  date: string;
  revenue: number;
  cogs: number;
  profit: number;
  unitsSold: number;
}

export interface BusinessOverview {
  totalInventoryValue: number;
  totalPotentialRevenue: number;
  grossRevenue: number;
  grossCogs: number;
  grossProfit: number;
  grossMarginPct: number | null;
  unpricedCount: number;
  dailyTrend: DailyFinancialPoint[];
  totalOperatingExpenses: number;
  totalOtherIncome: number;
  totalManualIncome?: number;
  netProfit: number;
  netMarginPct: number | null;
  expensesByCategory: ExpenseCategoryBreakdown[];
  thisMonth: { revenue: number; expenses: number; netProfit: number };
  lastMonth: { revenue: number; expenses: number; netProfit: number };
  dateMode: 'rolling30' | 'calendar';
  periodStart: string;
  periodEnd: string;
}

export type FinanceAttributeType =
  | 'REVENUE'
  | 'EXPENSE'
  | 'LEAK'
  | 'CREDIT'
  | 'LEDGER';

/** A searchable financial attribute (room, plan, class, commodity, expense,
 * leak, credit or ledger entry) returned by the finance explorer. */
export interface FinanceAttribute {
  id: string;
  type: FinanceAttributeType;
  label: string;
  subtitle: string | null;
  amount: number;
  sharePct: number | null;
  detail: string | null;
}

export interface FinanceSearchResult {
  businessType: string;
  period: 'rolling30' | 'calendar';
  totalMatched: number;
  results: FinanceAttribute[];
}

export interface CreateBusinessTransactionPayload {
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  description?: string;
  staffName?: string;
  date?: string;
  isRecurring?: boolean;
  recurrenceRule?: 'MONTHLY' | 'WEEKLY' | 'YEARLY';
}

// ─── Category definitions ─────────────────────────────────────────────────────

export const EXPENSE_CATEGORIES = [
  { value: 'RENT', label: 'Rent', emoji: '🏠' },
  { value: 'SALARY', label: 'Salary', emoji: '👤' },
  { value: 'UTILITIES', label: 'Utilities', emoji: '💡' },
  { value: 'LOAN', label: 'Loan', emoji: '🏦' },
  { value: 'SUPPLIES', label: 'Supplies', emoji: '📦' },
  { value: 'TRANSPORT', label: 'Transport', emoji: '🚗' },
  { value: 'MARKETING', label: 'Marketing', emoji: '📢' },
  { value: 'TAX', label: 'Tax', emoji: '🧾' },
  { value: 'SERVICES', label: 'Services', emoji: '🔧' },
  { value: 'MAINTENANCE', label: 'Maintenance & repairs', emoji: '🛠️' },
  { value: 'WASTAGE', label: 'Stock written off', emoji: '🗑️' },
  { value: 'OTHER_EXPENSE', label: 'Other', emoji: '📝' },
] as const;

export const INCOME_CATEGORIES = [
  { value: 'SERVICE_FEE', label: 'Service Fee', emoji: '💼' },
  { value: 'REFUND', label: 'Refund', emoji: '↩️' },
  { value: 'GRANT', label: 'Grant', emoji: '🎁' },
  { value: 'OTHER_INCOME', label: 'Other Income', emoji: '💵' },
] as const;

export function getCategoryLabel(category: string): string {
  const all = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
  return all.find((c) => c.value === category)?.label ?? category;
}

export function getCategoryEmoji(category: string): string {
  const all = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
  return all.find((c) => c.value === category)?.emoji ?? '📄';
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getBusinessOverview(
  token: string,
  organizationId: string,
  mode: 'rolling30' | 'calendar' = 'rolling30',
): Promise<BusinessOverview> {
  return apiGet<BusinessOverview>(
    `/finance/business-overview?mode=${mode}`,
    token,
    organizationId,
  );
}

export async function searchFinances(
  token: string,
  organizationId: string,
  query: string,
  mode: 'rolling30' | 'calendar' = 'rolling30',
): Promise<FinanceSearchResult> {
  const params = new URLSearchParams({ q: query, mode });
  return apiGet<FinanceSearchResult>(
    `/finance/search?${params.toString()}`,
    token,
    organizationId,
  );
}

export async function getBusinessTransactions(
  token: string,
  organizationId: string,
  filters?: { type?: 'INCOME' | 'EXPENSE'; category?: string; from?: string; to?: string },
): Promise<BusinessTransactionRecord[]> {
  const params = new URLSearchParams();
  if (filters?.type) params.append('type', filters.type);
  if (filters?.category) params.append('category', filters.category);
  if (filters?.from) params.append('from', filters.from);
  if (filters?.to) params.append('to', filters.to);
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiGet<BusinessTransactionRecord[]>(
    `/finance/business-transactions${query}`,
    token,
    organizationId,
  );
}

export async function createBusinessTransaction(
  payload: CreateBusinessTransactionPayload,
  token: string,
  organizationId: string,
): Promise<BusinessTransactionRecord> {
  return apiPost<BusinessTransactionRecord>(
    '/finance/business-transactions',
    token,
    organizationId,
    payload,
  );
}

export async function deleteBusinessTransaction(
  id: string,
  token: string,
  organizationId: string,
): Promise<void> {
  return apiDelete<void>(`/finance/business-transactions/${id}`, token, organizationId);
}

export interface UpdateBusinessTransactionPayload {
  category?: string;
  amount?: number;
  description?: string;
  staffName?: string;
  date?: string;
  isRecurring?: boolean;
  recurrenceRule?: string;
}

export async function updateBusinessTransaction(
  id: string,
  payload: UpdateBusinessTransactionPayload,
  token: string,
  organizationId: string,
): Promise<BusinessTransactionRecord> {
  return apiPatch<BusinessTransactionRecord>(
    `/finance/business-transactions/${id}`,
    token,
    organizationId,
    payload,
  );
}
