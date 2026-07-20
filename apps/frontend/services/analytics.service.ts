import { apiGet } from '@/lib/api-client';

export interface DashboardData {
  greeting: { timeOfDay: 'morning' | 'afternoon' | 'evening' };
  kpis: {
    todaySales: number;
    todayExpenses: number;
    lowStockCount: number;
    profitEstimate: number;
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
    lowStockCount: number;
    totalInventory: number;
    tasksDoneToday: number;
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
