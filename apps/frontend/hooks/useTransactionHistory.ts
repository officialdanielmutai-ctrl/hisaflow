'use client';

import useSWR from 'swr';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { getTransactions, TransactionRecord } from '@/services/transactions.service';

export function useTransactionHistory(
  filters?: { itemId?: string; type?: string },
) {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const orgId = membership?.organization.id;

  const fetcher = async () => {
    if (!orgId) throw new Error('No orgId');
    const token = await getToken();
    if (!token) throw new Error('No token');
    return getTransactions(token, orgId, filters);
  };

  const { data: transactions = [], error, isLoading } = useSWR<TransactionRecord[]>(
    orgId ? ['transactions', orgId, filters?.itemId, filters?.type] : null,
    fetcher
  );

  return { transactions, loading: isLoading, error: error ? 'Failed to load transactions' : null };
}
