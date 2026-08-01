import { apiGet } from '@/lib/api-client';

export interface DashboardData {
  greeting: { timeOfDay: 'morning' | 'afternoon' | 'evening' };
  kpis: {
    todaySales: number;
    salesTrendLabel: string;
    salesTrendIsPositive: boolean;
    todayExpenses: number;
    expensesTrendLabel: string;
    expensesTrendIsNegative: boolean;
    lowStockCount: number;
    lowStockLabel: string;
    profitEstimate: number;
    profitTrendLabel: string;
    profitTrendIsPositive: boolean;
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
}

export async function getDashboardData(
  token: string,
  organizationId: string
): Promise<DashboardData> {
  return apiGet<DashboardData>('/analytics/dashboard', token, organizationId);
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
  organizationId: string
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
