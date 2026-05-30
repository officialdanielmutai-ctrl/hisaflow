import { apiGet, apiPost } from '@/lib/api-client';

export interface InventoryItem {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  quantity: number;
  reorderThreshold: number | null;
  costPrice: number | null;
  sellingPrice: number | null;
  status: 'HEALTHY' | 'LOW' | 'CRITICAL' | 'OUT_OF_STOCK';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getInventoryItems(
  token: string,
  organizationId: string
): Promise<InventoryItem[]> {
  return apiGet<InventoryItem[]>('/inventory', token, organizationId);
}

export async function getInventoryItem(
  id: string,
  token: string,
  organizationId: string
): Promise<InventoryItem> {
  return apiGet<InventoryItem>(`/inventory/${id}`, token, organizationId);
}
