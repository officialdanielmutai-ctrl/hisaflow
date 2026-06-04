'use client';

import { useEffect, useState } from 'react';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { getInventoryItems, type InventoryItem } from '@/services/inventory.service';

export function useInventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();
  const { organization } = useOrganization();

  useEffect(() => {
    if (!organization?.id) {
      setLoading(false);
      return;
    }

    async function fetchItems() {
      try {
        const token = await getToken();
        if (!token) throw new Error('Not authenticated');
        const result = await getInventoryItems(token, organization!.id);
        setItems(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load inventory');
      } finally {
        setLoading(false);
      }
    }

    fetchItems();
  }, [organization?.id, getToken]);

  return { items, loading, error };
}
