'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { getTransactions, TransactionRecord } from '@/services/transactions.service';

export function useTransactionHistory(
  filters?: { itemId?: string; type?: string },
) {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();

  useEffect(() => {
    if (!membership) return;

    async function fetchTransactions() {
      try {
        const token = await getToken();
        if (!token) {
          setLoading(false);
          return;
        }
        const data = await getTransactions(
          token,
          membership!.organization.id,
          filters,
        );
        setTransactions(data);
      } catch (err) {
        setError('Failed to load transactions');
      } finally {
        setLoading(false);
      }
    }

    fetchTransactions();
  }, [membership, filters?.itemId, filters?.type, getToken]);

  return { transactions, loading, error };
}
