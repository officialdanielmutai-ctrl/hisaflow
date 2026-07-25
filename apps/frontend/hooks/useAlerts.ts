'use client';

import { useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import {
  getActiveAlerts,
  resolveAlert,
  resolveAllAlerts,
  triggerAlertCheck,
  type Alert,
} from '@/services/alerts.service';

// Shared SWR key so TopBar and AlertsPage share the same cache.
const ALERTS_KEY = 'active-alerts';

// Lightweight fetcher that ONLY reads alerts (used by TopBar badge).
async function alertsFetcher(token: string, orgId: string): Promise<Alert[]> {
  return getActiveAlerts(token, orgId);
}

export function useAlerts(options?: { triggerCheck?: boolean }) {
  const { getToken, isLoaded } = useAuth();
  const { membership } = useMyOrganization();
  const orgId = membership?.organization.id;
  const shouldCheck = options?.triggerCheck ?? false;

  const { data, error, isLoading, mutate } = useSWR<Alert[]>(
    isLoaded && orgId ? [ALERTS_KEY, orgId] : null,
    async ([_, id]: [string, string]) => {
      const token = await getToken();
      if (!token || !id) throw new Error('Not authenticated');

      // Only run the expensive anomaly check when explicitly requested
      // (i.e., when the full Alerts page opens, not on every TopBar render).
      if (shouldCheck) {
        triggerAlertCheck(token, id).catch(() => {});
      }

      return alertsFetcher(token, id);
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  );

  const dismiss = useCallback(async (alertId: string) => {
    if (!orgId) return;
    try {
      const token = await getToken();
      if (!token) return;
      // Optimistically remove from the shared cache instantly
      mutate((prev) => (prev ? prev.filter(a => a.id !== alertId) : []), false);
      await resolveAlert(alertId, token, orgId);
      mutate();
    } catch (e) {
      console.error('Failed to dismiss alert:', e);
      mutate();
    }
  }, [orgId, getToken, mutate]);

  const dismissAll = useCallback(async () => {
    if (!orgId) return;
    try {
      const token = await getToken();
      if (!token) return;
      // Optimistically clear all immediately — badge goes to 0 right away
      mutate([], false);
      await resolveAllAlerts(token, orgId);
      mutate();
    } catch (e) {
      console.error('Failed to dismiss all alerts:', e);
      mutate();
    }
  }, [orgId, getToken, mutate]);

  return {
    data,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    dismiss,
    dismissAll,
  };
}
