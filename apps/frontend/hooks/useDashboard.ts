'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getDashboardData, DashboardData } from '@/services/analytics.service';

export function useDashboard(organizationId: string | null) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const token = await getToken();
        if (!token) throw new Error('Not authenticated');
        const result = await getDashboardData(token, organizationId!);
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [organizationId, getToken]);

  return { data, loading, error };
}
