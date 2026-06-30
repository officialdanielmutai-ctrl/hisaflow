import { apiGet, apiPatch } from '@/lib/api-client';

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface DailyFinancialPoint {
  date: string;
  revenue: number;
  cogs: number;
  profit: number;
  unitsSold: number;
}

export interface FinanceOverview {
  totalInventoryValue: number;
  totalPotentialRevenue: number;
  totalRevenue: number;
  totalCogs: number;
  totalProfit: number;
  grossMarginPct: number | null;
  unpricedCount: number;
  dailyTrend: DailyFinancialPoint[];
}

export interface ItemFinancialProfile {
  id: string;
  name: string;
  unit: string;
  costPrice: number | null;
  sellingPrice: number | null;
  currentStock: number;
  stockValue: number;
  totalRevenue: number;
  totalCogs: number;
  totalProfit: number;
  grossMarginPct: number | null;
  dailyTrend: DailyFinancialPoint[];
}

export interface ForecastInsight {
  title: string;
  body: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
}

export interface PriceSuggestion {
  itemId: string;
  name: string;
  unit: string;
  currentCostPrice: number | null;
  currentSellingPrice: number | null;
  suggestedCostPrice: number | null;
  suggestedSellingPrice: number | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  note: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getFinanceOverview(
  token: string,
  organizationId: string,
): Promise<FinanceOverview> {
  return apiGet<FinanceOverview>('/finance/overview', token, organizationId);
}

export async function getItemFinancialProfile(
  itemId: string,
  token: string,
  organizationId: string,
): Promise<ItemFinancialProfile> {
  return apiGet<ItemFinancialProfile>(`/finance/item/${itemId}`, token, organizationId);
}

export async function getFinanceForecast(
  token: string,
  organizationId: string,
): Promise<{ insights: ForecastInsight[] }> {
  return apiGet<{ insights: ForecastInsight[] }>('/finance/forecast', token, organizationId);
}

export async function getPriceSuggestions(
  token: string,
  organizationId: string,
): Promise<PriceSuggestion[]> {
  return apiGet<PriceSuggestion[]>('/finance/price-suggestions', token, organizationId);
}

export async function confirmItemPrice(
  itemId: string,
  costPrice: number,
  sellingPrice: number,
  token: string,
  organizationId: string,
): Promise<void> {
  await apiPatch(`/inventory/${itemId}`, token, organizationId, { costPrice, sellingPrice });
}
