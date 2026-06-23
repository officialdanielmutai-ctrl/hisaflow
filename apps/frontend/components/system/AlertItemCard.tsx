'use client';

import type { Alert } from '@/services/alerts.service';

interface AlertItemCardProps {
  alert: Alert;
  onDismiss?: () => void;
}

export default function AlertItemCard({ alert, onDismiss }: AlertItemCardProps) {
  const isCritical = alert.severity === 'CRITICAL';

  return (
    <div
      className={`rounded-2xl border p-4 ${
        isCritical
          ? 'border-red-400 bg-red-50'
          : 'border-yellow-400 bg-yellow-50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{alert.title}</p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {alert.description}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            isCritical
              ? 'bg-red-500 text-white'
              : 'bg-yellow-500 text-white'
          }`}
        >
          {alert.severity}
        </span>
      </div>
      {onDismiss && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={onDismiss}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
