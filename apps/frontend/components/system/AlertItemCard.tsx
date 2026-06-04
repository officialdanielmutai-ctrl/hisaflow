'use client';

import type { Alert } from '@/services/alerts.service';

interface AlertItemCardProps {
  alert: Alert;
}

export default function AlertItemCard({ alert }: AlertItemCardProps) {
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
        <p className="text-sm font-medium">{alert.message}</p>
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
    </div>
  );
}
