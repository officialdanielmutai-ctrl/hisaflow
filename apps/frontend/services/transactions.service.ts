import { apiPost } from '@/lib/api-client';

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

export async function logTransaction(
  payload: LogTransactionPayload,
  token: string,
  organizationId: string,
): Promise<TransactionResult> {
  return apiPost<TransactionResult>(
    '/transactions',
    payload,
    token,
    organizationId,
  );
}
