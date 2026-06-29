'use client';

import type { Alert } from '@/services/alerts.service';

const TYPE_LABELS: Record<string, string> = {
  LOW_STOCK: 'Low Stock',
  OUT_OF_STOCK: 'Out of Stock',
  DEAD_STOCK: 'Dead Stock',
  EXPIRY_RISK: 'Expiry Risk',
  VARIANCE: 'High Wastage',
};

interface AlertItemCardProps {
  alert: Alert;
  onDismiss?: () => void;
}

export default function AlertItemCard({ alert, onDismiss }: AlertItemCardProps) {
  const isCritical = alert.severity === 'CRITICAL';
  const isWarning = alert.severity === 'WARNING';
  const isInfo = alert.severity === 'INFO';

  const borderBg = isCritical
    ? 'border-red-400 bg-red-50'
    : isWarning
    ? 'border-yellow-400 bg-yellow-50'
    : 'border-blue-300 bg-blue-50';

  const badgeBg = isCritical
    ? 'bg-red-500 text-white'
    : isWarning
    ? 'bg-yellow-500 text-white'
    : 'bg-blue-400 text-white';

  const typeLabel = TYPE_LABELS[alert.type] ?? alert.type;

  return (
    <div className={`rounded-2xl border p-4 ${borderBg}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{alert.title}</p>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {alert.description}
          </p>
          {alert.item && (
            <p className="mt-1 text-xs text-[var(--color-text-secondary)] opacity-70">
              Item: {alert.item.name}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeBg}`}>
            {alert.severity}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {typeLabel}
          </span>
        </div>
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
