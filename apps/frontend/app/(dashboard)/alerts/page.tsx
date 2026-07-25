'use client';

import { useEffect, useState } from 'react';
import { useAlerts } from '@/hooks/useAlerts';
import AlertItemCard from '@/components/system/AlertItemCard';
import { CheckCircle } from 'lucide-react';
import type { Alert } from '@/services/alerts.service';

export default function AlertsPage() {
  // Pass triggerCheck: true so that opening the page triggers a fresh backend anomaly check
  const { data: alerts, loading, error, dismiss, dismissAll } = useAlerts({ triggerCheck: true });
  
  // We keep a local snapshot of the alerts so we can show them to the user,
  // even after we auto-dismiss them in the background to clear the badge.
  const [displayedAlerts, setDisplayedAlerts] = useState<Alert[] | null>(null);
  const [hasAutoDismissed, setHasAutoDismissed] = useState(false);

  useEffect(() => {
    // Once alerts are loaded for the first time, capture them in local state
    if (alerts && displayedAlerts === null && !loading) {
      setDisplayedAlerts(alerts);
      
      // If there are alerts, auto-dismiss them in the background so the TopBar badge clears
      if (alerts.length > 0 && !hasAutoDismissed) {
        setHasAutoDismissed(true);
        // We use a slight delay to ensure SWR has settled before we fire a mutation
        setTimeout(() => {
          dismissAll();
        }, 1000);
      }
    }
  }, [alerts, displayedAlerts, loading, hasAutoDismissed, dismissAll]);

  const handleDismissCard = (id: string) => {
    // Remove from local snapshot
    if (displayedAlerts) {
      setDisplayedAlerts(displayedAlerts.filter((a) => a.id !== id));
    }
    // Also tell the backend/SWR to dismiss it just in case auto-dismiss hasn't fired yet
    dismiss(id);
  };

  const handleDismissAll = () => {
    setDisplayedAlerts([]);
    dismissAll();
  };

  // Use displayedAlerts if we have captured them, otherwise fallback to the SWR alerts
  const currentAlerts = displayedAlerts !== null ? displayedAlerts : alerts;

  if (loading && !currentAlerts) {
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
    <div className="flex flex-col gap-4 pb-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Alerts</h1>
        {currentAlerts && currentAlerts.length > 0 && (
          <button 
            onClick={handleDismissAll}
            className="text-sm font-semibold text-[var(--color-accent)] hover:underline"
          >
            Clear List
          </button>
        )}
      </div>
      {!currentAlerts || currentAlerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle className="mb-4 h-12 w-12 text-green-500" />
          <p className="text-base text-[var(--color-text-primary)]">
            No active alerts
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {currentAlerts.map((alert: any) => (
            <AlertItemCard key={alert.id} alert={alert} onDismiss={() => handleDismissCard(alert.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
