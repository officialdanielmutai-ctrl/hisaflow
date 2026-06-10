'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from './useMyOrganization';
import { getInventoryItems, type InventoryItem } from '@/services/inventory.service';

export function useInventory(refreshKey = 0) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();

  useEffect(() => {
    const organizationId = membership?.organization.id;
    if (!organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    async function fetchItems() {
      try {
        const token = await getToken();
        if (!token) throw new Error('Not authenticated');
        const result = await getInventoryItems(token, organizationId!);
        setItems(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load inventory');
      } finally {
        setLoading(false);
      }
    }

    fetchItems();
  }, [membership?.organization.id, getToken, refreshKey]);

  return { items, loading, error };
}