import { apiGet } from '@/lib/api-client';
import type {
  DailyPerformancePoint,
  MetricDashboardResponse,
  PeriodComparison,
  ResolvedAnalyticsRange,
  SeriesBucket,
} from '@hisaflow/types';

export interface GrowthTimeframeBucket {
  total: number;
  count: number;
  comparison: PeriodComparison;
}

export interface DashboardSelectedPeriod {
  range: ResolvedAnalyticsRange;
  salesTotal: number;
  expensesTotal: number;
  profitTotal: number;
  salesComparison: PeriodComparison;
  expensesComparison: PeriodComparison;
  profitComparison: PeriodComparison;
  dailyPerformance: DailyPerformancePoint[];
  sevenDaySales: SeriesBucket[];
  sevenDayExpenses: SeriesBucket[];
  sevenDayProfit: SeriesBucket[];
  growthByTimeframe: {
    '12h': GrowthTimeframeBucket;
    '24h': GrowthTimeframeBucket;
    week: GrowthTimeframeBucket;
    month: GrowthTimeframeBucket;
  };
  generatedAt: string;
}

export interface DashboardData {
  greeting: { timeOfDay: 'morning' | 'afternoon' | 'evening' };
  kpis: {
    todaySales: number;
    salesTrendLabel: string;
    salesTrendIsPositive: boolean;
    salesTrendPct?: number;
    todayExpenses: number;
    expensesTrendLabel: string;
    expensesTrendIsNegative: boolean;
    expensesTrendPct?: number;
    lowStockCount: number;
    lowStockLabel: string;
    profitEstimate: number;
    profitTrendLabel: string;
    profitTrendIsPositive: boolean;
    profitTrendPct?: number;
  };
  attentionFeed: Array<{
    id: string;
    message: string;
    severity: 'WARNING' | 'CRITICAL';
    type: string;
  }>;
  inventorySnapshot: {
    total: number;
    healthy: number;
    low: number;
    outOfStock: number;
    stockHealthPct: number;
  };
  recommendedActions: Array<{
    action: string;
    reason: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  selectedPeriod?: DashboardSelectedPeriod;
}

export async function getDashboardData(
  token: string,
  organizationId: string,
  query?: { preset?: string; from?: string; to?: string },
  signal?: AbortSignal,
): Promise<DashboardData> {
  const params = new URLSearchParams();
  if (query?.preset) params.set('preset', query.preset);
  if (query?.from) params.set('from', query.from);
  if (query?.to) params.set('to', query.to);
  const qs = params.toString();
  return apiGet<DashboardData>(
    `/analytics/dashboard${qs ? `?${qs}` : ''}`,
    token,
    organizationId,
    signal,
  );
}

export async function getMetricSeries(
  token: string,
  organizationId: string,
  query: { metric?: string; preset?: string; from?: string; to?: string } = {},
  signal?: AbortSignal,
): Promise<MetricDashboardResponse> {
  const params = new URLSearchParams();
  if (query.metric) params.set('metric', query.metric);
  if (query.preset) params.set('preset', query.preset);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  const qs = params.toString();
  return apiGet<MetricDashboardResponse>(
    `/analytics/metrics${qs ? `?${qs}` : ''}`,
    token,
    organizationId,
    signal,
  );
}

export interface StaffDashboardData {
  greeting: { timeOfDay: 'morning' | 'afternoon' | 'evening' };
  kpis: {
    todaySalesCount: number;
    todaySalesTrend: number;
    todaySalesTrendLabel: string;
    lowStockCount: number;
    totalInventory: number;
    totalInventoryLabel: string;
    tasksDoneToday: number;
    tasksLabel: string;
  };
  attentionFeed: Array<{
    id: string;
    message: string;
    severity: 'WARNING' | 'CRITICAL' | 'INFO';
    type: string;
    createdAt?: string;
  }>;
  lowStockWatchList: Array<{
    id: string;
    name: string;
    quantity: number;
    unit: string;
  }>;
  recommendedActions: Array<{
    action: string;
    reason: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
}

export async function getStaffDashboardData(
  token: string,
  organizationId: string,
): Promise<StaffDashboardData> {
  return apiGet<StaffDashboardData>('/analytics/staff-dashboard', token, organizationId);
}

// ── Guest House Dashboard ──────────────────────────────────────────────────────

export interface BookingSummary {
  id: string;
  guestName: string;
  roomName: string;
  checkOutDate: string;
}

export interface GuestHouseDashboardData {
  occupiedRooms: number;
  totalRooms: number;
  occupancyRate: number;
  revenueThisMonth: number;
  costThisMonth: number;
  profitThisMonth: number;
  outstandingBalance: number;
  collectionHealthPct?: number;
  revenueComparison?: PeriodComparison;
  dailySeries?: {
    revenue: SeriesBucket[];
    occupancyPct: SeriesBucket[];
  };
  generatedAt?: string;
  departureAlerts: {
    overdue: BookingSummary[];
    today: BookingSummary[];
    tomorrow: BookingSummary[];
  };
  fastMovingStock: Array<{
    itemId: string;
    name: string;
    unit: string;
    currentQty: number;
    totalConsumed: number;
  }>;
  lowStockItems: Array<{
    itemId: string;
    name: string;
    unit: string;
    quantity: number;
    reorderThreshold: number;
  }>;
}

export async function getGuestHouseDashboardData(
  token: string,
  organizationId: string,
): Promise<GuestHouseDashboardData> {
  return apiGet<GuestHouseDashboardData>('/analytics/guesthouse-dashboard', token, organizationId);
}

// ── School Dashboard ───────────────────────────────────────────────────────────

export interface SchoolDashboardData {
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  totalStudents: number;
  totalClasses: number;
  activeTerm: { name: string; dueDate: string | null } | null;
  fees: {
    totalExpected: number;
    totalCollected: number;
    outstanding: number;
    collectionRate: number;
    paidCount: number;
    totalInvoices: number;
  };
  collectionsComparison?: PeriodComparison;
  dailySeries?: {
    collections: SeriesBucket[];
  };
  generatedAt?: string;
  overdueInvoices: Array<{
    id: string;
    studentName: string;
    termName: string;
    amountDue: number;
    status: string;
  }>;
  recentPayments: Array<{
    id: string;
    studentName: string;
    amount: number;
    method: string;
    recordedAt: string;
  }>;
}

export async function getSchoolDashboardData(
  token: string,
  organizationId: string,
): Promise<SchoolDashboardData> {
  return apiGet<SchoolDashboardData>('/analytics/school-dashboard', token, organizationId);
}

// ── Chemist Dashboard ──────────────────────────────────────────────────────────

export interface ChemistDashboardData {
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  todaySales: number;
  monthSales: number;
  lowStockCount: number;
  totalItems: number;
  todaySalesComparison?: PeriodComparison;
  monthSalesComparison?: PeriodComparison;
  dailySeries?: {
    sales: SeriesBucket[];
  };
  generatedAt?: string;
  expiringBatches: Array<{
    id: string;
    productName: string;
    quantity: number;
    expiryDate: string;
    daysLeft: number;
  }>;
  expiredBatches: Array<{
    id: string;
    productName: string;
    quantity: number;
    expiryDate: string;
    daysLeft: number;
  }>;
  topSellers: Array<{ itemId: string; name: string; unit: string; totalSold: number }>;
  alerts: Array<{ id: string; message: string; severity: string }>;
}

export async function getChemistDashboardData(
  token: string,
  organizationId: string,
): Promise<ChemistDashboardData> {
  return apiGet<ChemistDashboardData>('/analytics/chemist-dashboard', token, organizationId);
}

// ── Restaurant Dashboard ───────────────────────────────────────────────────────

export interface RestaurantDashboardData {
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  todayRevenue: number;
  openOrdersCount: number;
  openOrdersValue: number;
  paidOrdersToday: number;
  revenueComparison?: PeriodComparison;
  dailySeries?: {
    revenue: SeriesBucket[];
    orders: SeriesBucket[];
  };
  generatedAt?: string;
  openOrders: Array<{
    id: string;
    tableLabel: string | null;
    itemCount: number;
    orderValue: number;
    createdAt: string;
  }>;
  topMenuItems: Array<{ itemId: string; name: string; unit: string; totalSold: number }>;
  alerts: Array<{ id: string; message: string; severity: string }>;
}

export async function getRestaurantDashboardData(
  token: string,
  organizationId: string,
): Promise<RestaurantDashboardData> {
  return apiGet<RestaurantDashboardData>('/analytics/restaurant-dashboard', token, organizationId);
}

// ── Wholesale Dashboard ────────────────────────────────────────────────────────

export interface WholesaleDashboardData {
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  todaySales: number;
  monthSales: number;
  totalOutstanding: number;
  openCreditCount: number;
  lowStockCount: number;
  totalItems: number;
  todaySalesComparison?: PeriodComparison;
  monthSalesComparison?: PeriodComparison;
  dailySeries?: {
    sales: SeriesBucket[];
  };
  generatedAt?: string;
  topDebtors: Array<{
    id: string;
    clientName: string;
    amountOwed: number;
    status: string;
  }>;
  topSellers: Array<{ itemId: string; name: string; unit: string; totalSold: number }>;
  alerts: Array<{ id: string; message: string; severity: string }>;
}

export async function getWholesaleDashboardData(
  token: string,
  organizationId: string,
): Promise<WholesaleDashboardData> {
  return apiGet<WholesaleDashboardData>('/analytics/wholesale-dashboard', token, organizationId);
}
