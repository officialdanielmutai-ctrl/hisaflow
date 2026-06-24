'use client';

import { useAlerts } from '@/hooks/useAlerts';
import AlertItemCard from '@/components/system/AlertItemCard';
import { CheckCircle } from 'lucide-react';

export default function AlertsPage() {
  const { data: alerts, isLoading, error, dismiss } = useAlerts();

  if (isLoading) {
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
      {!alerts || alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle className="mb-4 h-12 w-12 text-green-500" />
          <p className="text-base text-[var(--color-text-primary)]">
            No active alerts
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {alerts.map((alert: any) => (
            <AlertItemCard key={alert.id} alert={alert} onDismiss={() => dismiss(alert.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
