import { apiGet, apiPost, apiPatch } from '@/lib/api-client';

export interface CreditRecord {
  id: string;
  organizationId: string;
  clientName: string;
  transactionId: string | null;
  amountTotal: string | number;
  amountPaid: string | number;
  dueDate: string | null;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  transaction?: {
    item: {
      id: string;
      name: string;
      unit: string;
    };
  };
}

export async function getCredits(
  token: string,
  organizationId: string,
  status?: 'UNPAID' | 'PARTIAL' | 'PAID',
): Promise<CreditRecord[]> {
  const query = status ? `?status=${status}` : '';
  return apiGet<CreditRecord[]>(`/finance/credits${query}`, token, organizationId);
}

export async function recordPayment(
  id: string,
  amount: number,
  notes: string | undefined,
  token: string,
  organizationId: string,
): Promise<CreditRecord> {
  return apiPost<CreditRecord>(
    `/finance/credits/${id}/payments`,
    token,
    organizationId,
    { amount, notes },
  );
}
