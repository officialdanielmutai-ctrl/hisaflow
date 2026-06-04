'use client';

import { useState, useEffect } from 'react';
import { useAuth, useOrganization } from '@clerk/nextjs';
import {
  getActiveAlerts,
  triggerAlertCheck,
  type Alert,
} from '@/services/alerts.service';
import AlertItemCard from '@/components/system/AlertItemCard';
import { CheckCircle } from 'lucide-react';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();
  const { organization } = useOrganization();

  useEffect(() => {
    if (!organization?.id) return;

    async function fetchAlerts() {
      try {
        const token = await getToken();
        if (!token) throw new Error('Not authenticated');
        // Trigger alert check (fire and forget)
        triggerAlertCheck(token, organization!.id).catch((e) =>
          console.error('Alert check failed', e),
        );
        const result = await getActiveAlerts(token, organization!.id);
        setAlerts(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load alerts');
      } finally {
        setLoading(false);
      }
    }

    fetchAlerts();
  }, [organization?.id, getToken]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold">Alerts</h1>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-20 w-full animate-pulse rounded-2xl bg-muted"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center text-[var(--color-text-secondary)]">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Alerts</h1>
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle className="mb-4 h-12 w-12 text-green-500" />
          <p className="text-base text-[var(--color-text-primary)]">
            No active alerts
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {alerts.map((alert) => (
            <AlertItemCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
}
