'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import {
  getActiveAlerts,
  resolveAlert,
  type Alert,
} from '@/services/alerts.service';

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();

  useEffect(() => {
    if (!membership?.organization.id) {
      setLoading(false);
      return;
    }

    async function fetchAlerts() {
      try {
        const token = await getToken();
        if (!token) throw new Error('Not authenticated');
        const result = await getActiveAlerts(token, membership!.organization.id);
        setAlerts(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load alerts');
      } finally {
        setLoading(false);
      }
    }

    fetchAlerts();
  }, [membership?.organization.id, getToken]);

  const dismiss = useCallback(async (alertId: string) => {
    const orgId = membership?.organization.id;
    if (!orgId) return;
    try {
      const token = await getToken();
      if (!token) return;
      await resolveAlert(alertId, token, orgId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (e) {
      console.error('Failed to resolve alert', e);
    }
  }, [membership?.organization.id, getToken]);

  return { data: alerts, isLoading: loading, error, dismiss };
}
