import { apiGet, apiPost } from '@/lib/api-client';

export interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  unit: string;
  quantity: number;
  reorderThreshold: number;
  costPrice: number | null;
  sellingPrice: number | null;
  isActive: boolean;
}

export async function getInventoryItems(
  token: string,
  organizationId: string,
): Promise<InventoryItem[]> {
  return apiGet<InventoryItem[]>('/inventory', token, organizationId);
}

export interface CreateProductPayload {
  name: string;
  sku?: string;
  category?: string;
  unit: string;
  quantity: number;
  reorderThreshold: number;
  costPrice?: number;
  sellingPrice?: number;
}

export async function createInventoryItem(
  payload: CreateProductPayload,
  token: string,
  organizationId: string,
): Promise<InventoryItem> {
  return apiPost<InventoryItem>('/inventory', payload, token, organizationId);
}
