import { apiGet, apiPost, apiPatch } from '@/lib/api-client';

export interface PackagingUnit {
  id: string;
  name: string;
  quantityPerUnit: number;
  barcode?: string | null;
  costPrice?: number | null;
  sellingPrice?: number | null;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  measureValue?: number | null;
  measureUnit?: string | null;
  quantity: number;
  reorderThreshold: number;
  costPrice: number | null;
  sellingPrice: number | null;
  status: 'HEALTHY' | 'LOW' | 'OUT_OF_STOCK';
  isActive: boolean;
  packaging: PackagingUnit[];
}

export interface Product {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  variants: InventoryItem[];
}

export async function getInventoryItems(
  token: string,
  organizationId: string,
): Promise<Product[]> {
  return apiGet<Product[]>('/inventory', token, organizationId);
}

export interface CreatePackagingUnitPayload {
  name: string;
  quantityPerUnit: number;
  barcode?: string;
  costPrice?: number;
  sellingPrice?: number;
}

export interface CreateProductVariantPayload {
  name: string;
  unit: string;
  measureValue?: number;
  measureUnit?: string;
  quantity: number;
  reorderThreshold: number;
  costPrice?: number;
  sellingPrice?: number;
  packaging?: CreatePackagingUnitPayload[];
}

export interface CreateProductPayload {
  name: string;
  category?: string;
  description?: string;
  variants?: CreateProductVariantPayload[];

  // Fallbacks for legacy creation
  unit?: string;
  quantity?: number;
  reorderThreshold?: number;
  costPrice?: number;
  sellingPrice?: number;
}

export async function createInventoryItem(
  payload: CreateProductPayload,
  token: string,
  organizationId: string,
): Promise<Product> {
  return apiPost<Product>('/inventory', token, organizationId, payload);
}

export interface UpdateProductPayload {
  name?: string;
  category?: string;
  description?: string;
}

export async function updateInventoryItem(
  id: string,
  payload: UpdateProductPayload,
  token: string,
  organizationId: string,
): Promise<Product> {
  return apiPatch<Product>(`/inventory/${id}`, token, organizationId, payload);
}
