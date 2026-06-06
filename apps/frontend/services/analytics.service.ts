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
