import { apiGet, apiPost, apiPatch } from '@/lib/api-client';

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
  expiryDate?: string | null;
  serialNumber?: string | null;
  batchNumber?: string | null;
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
  expiryDate?: string;
  serialNumber?: string;
  batchNumber?: string;
}

export async function createInventoryItem(
  payload: CreateProductPayload,
  token: string,
  organizationId: string,
): Promise<InventoryItem> {
  return apiPost<InventoryItem>('/inventory', token, organizationId, payload);
}

export interface UpdateProductPayload {
  name?: string;
  unit?: string;
  category?: string;
  quantity?: number;
  reorderThreshold?: number;
  costPrice?: number;
  sellingPrice?: number;
  expiryDate?: string;
  serialNumber?: string;
  batchNumber?: string;
}

export async function updateInventoryItem(
  id: string,
  payload: UpdateProductPayload,
  token: string,
  organizationId: string,
): Promise<InventoryItem> {
  return apiPatch<InventoryItem>(`/inventory/${id}`, token, organizationId, payload);
}
