import { apiGet, apiPost } from '@/lib/api-client';
export type TransactionType = 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'WASTAGE';
export interface LogTransactionPayload {
  itemId: string;
  type: TransactionType;
  quantity: number;
  note?: string;
}
export interface TransactionResult {
  success: boolean;
  newQuantity: number;
}
export interface TransactionRecord {
  id: string;
  type: string;
  quantity: number;
  note: string | null;
  createdAt: string;
  inventoryItem: { id: string; name: string; unit: string };
}

export async function getTransactions(
  token: string,
  organizationId: string,
  filters?: { itemId?: string; type?: string },
): Promise<TransactionRecord[]> {
  const params = new URLSearchParams();
  if (filters?.itemId) {
    params.append('itemId', filters.itemId);
  }
  if (filters?.type) {
    params.append('type', filters.type);
  }
  const query = params.toString() ? `?${params.toString()}` : '';

  return apiGet<TransactionRecord[]>(
    `/transactions${query}`,
    token,
    organizationId,
  );
}

export async function logTransaction(
  payload: LogTransactionPayload,
  token: string,
  organizationId: string,
): Promise<TransactionResult> {
  return apiPost<TransactionResult>(
    '/transactions',
    token,
    organizationId,
    payload,
  );
}
