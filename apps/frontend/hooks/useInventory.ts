'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getInventoryItems, InventoryItem } from '@/services/inventory.service';

export function useInventory(organizationId: string | null) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

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
  }, [organizationId, getToken]);

  return { items, loading, error };
}
