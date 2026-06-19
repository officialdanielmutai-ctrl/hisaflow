'use client';

import { useAlerts } from '@/hooks/useAlerts';

export default function AlertsPage() {
  const { data: alerts, isLoading, error } = useAlerts();

  if (isLoading) return <div>Loading alerts...</div>;
  if (error) return <div>Error loading alerts: {(error as Error).message}</div>;

  return (
    <div>
      <h1>Alerts</h1>
      {alerts?.map((alert) => (
        <div key={alert.id}>{alert.title}</div>
      ))}
    </div>
  );
}
