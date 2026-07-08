'use client';

import useSWR from 'swr';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from './useMyOrganization';
import { getInventoryItems, type InventoryItem } from '@/services/inventory.service';

export function useInventory() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const orgId = membership?.organization.id;

  const fetcher = async () => {
    if (!orgId) throw new Error('No orgId');
    const token = await getToken();
    if (!token) throw new Error('No token');
    return getInventoryItems(token, orgId);
  };

  const { data: items = [], error, isLoading, mutate } = useSWR<InventoryItem[]>(
    orgId ? ['inventory', orgId] : null,
    fetcher
  );

  return { items, loading: isLoading, error: error ? 'Failed to load inventory' : null, mutate };
}