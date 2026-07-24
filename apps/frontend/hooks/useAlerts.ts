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

export function useAlerts() {
  const { getToken, isLoaded } = useAuth();
  const { membership } = useMyOrganization();
  const orgId = membership?.organization.id;

  const fetcher = async () => {
    const token = await getToken();
    if (!token || !orgId) throw new Error('Not authenticated');

    // Run heavy anomaly checks in the background (fire and forget).
    // This removes the blocking waterfall and makes the UI instant.
    triggerAlertCheck(token, orgId).catch(() => {});

    // Fetch existing alerts from DB instantly
    return getActiveAlerts(token, orgId);
  };

  const { data, error, isLoading, mutate } = useSWR<Alert[]>(
    isLoaded && orgId ? ['alerts', orgId] : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 30_000,
    }
  );

  const dismiss = useCallback(async (alertId: string) => {
    if (!orgId) return;
    try {
      const token = await getToken();
      if (!token) return;
      // Optimistically remove from UI instantly
      mutate((prev) => (prev ? prev.filter(a => a.id !== alertId) : []), false);
      await resolveAlert(alertId, token, orgId);
      mutate();
    } catch (e) {
      console.error('Failed to dismiss alert:', e);
      mutate(); // Revert on failure
    }
  }, [orgId, getToken, mutate]);

  const dismissAll = useCallback(async () => {
    if (!orgId || !data?.length) return;
    try {
      const token = await getToken();
      if (!token) return;
      // Optimistically clear all immediately
      mutate([], false);
      await resolveAllAlerts(token, orgId);
      mutate();
    } catch (e) {
      console.error('Failed to dismiss all alerts:', e);
      mutate(); // Revert on failure
    }
  }, [orgId, getToken, mutate, data]);

  return {
    data,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    dismiss,
    dismissAll,
  };
}
