import { apiGet } from '@/lib/api-client';

export interface OperationalSnapshot {
  todaySales: number;
  todayExpenses: number;
  lowStockCount: number;
  criticalStockCount: number;
  outOfStockCount: number;
  totalItems: number;
}

export interface AttentionFeedItem {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  itemId?: string;
}

export interface InventoryHealthData {
  healthScore: number;
  fastMoving: { itemId: string; totalSold: number }[];
  deadStock: { id: string; name: string; quantity: number }[];
}

export interface DashboardData {
  snapshot: OperationalSnapshot;
  attentionFeed: AttentionFeedItem[];
  inventoryHealth: InventoryHealthData;
}

export async function getDashboard(
  token: string,
  organizationId: string
): Promise<DashboardData> {
  return apiGet<DashboardData>('/analytics/dashboard', token, organizationId);
}

export async function getAttentionFeed(
  token: string,
  organizationId: string
): Promise<AttentionFeedItem[]> {
  return apiGet<AttentionFeedItem[]>('/analytics/attention-feed', token, organizationId);
}
