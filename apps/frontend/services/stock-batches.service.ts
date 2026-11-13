import { apiGet, apiPost } from '@/lib/api-client';

export interface StockBatch {
  id: string;
  organizationId: string;
  inventoryItemId: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  costPrice?: number | null;
  createdAt: string;
}

export interface CreateStockBatchPayload {
  inventoryItemId: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  costPrice?: number;
}

export function getStockBatches(
  itemId: string,
  token: string,
  organizationId: string,
): Promise<StockBatch[]> {
  return apiGet<StockBatch[]>(
    `/stock-batches/item/${itemId}`,
    token,
    organizationId,
  );
}

export function createStockBatch(
  payload: CreateStockBatchPayload,
  token: string,
  organizationId: string,
): Promise<StockBatch> {
  return apiPost<StockBatch>(
    '/stock-batches',
    token,
    organizationId,
    payload,
  );
}
