'use client';

import { useState } from 'react';
import { useTransactionHistory } from '@/hooks/useTransactionHistory';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import AppShell from '@/components/layout/AppShell';
import { Skeleton } from '@/components/ui/skeleton';

const TYPE_COLORS: Record<string, string> = {
  SALE: 'bg-red-100 text-red-700',
  PURCHASE: 'bg-green-100 text-green-700',
  ADJUSTMENT: 'bg-yellow-100 text-yellow-700',
  WASTAGE: 'bg-orange-100 text-orange-700',
  RETURN: 'bg-blue-100 text-blue-700',
};

const FILTER_OPTIONS = [
  { label: 'All', value: undefined },
  { label: 'Sale', value: 'SALE' },
  { label: 'Purchase', value: 'PURCHASE' },
  { label: 'Adjustment', value: 'ADJUSTMENT' },
  { label: 'Wastage', value: 'WASTAGE' },
  { label: 'Return', value: 'RETURN' },
];

function getQuantitySignAndColor(type: string) {
  switch (type) {
    case 'SALE':
    case 'WASTAGE':
      return { sign: '-', color: 'text-[var(--color-status-critical)]' };
    case 'PURCHASE':
    case 'RETURN':
      return { sign: '+', color: 'text-[var(--color-status-success)]' };
    default:
      return { sign: '', color: 'text-[var(--color-text-secondary)]' };
  }
}

export default function TransactionsPage() {
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const { membership } = useMyOrganization();
  const { transactions, loading, error } = useTransactionHistory({
    type: typeFilter,
  });

  return (
    <AppShell
      activeTab="transactions"
      businessName={membership?.organization.name ?? 'Hisaflow'}
    >
      <div className="p-4">
        {/* Page header */}
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Transactions
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1 mb-4">
          Your full activity log
        </p>

        {/* Filter row – horizontal scrollable pills */}
        <div className="flex overflow-x-auto gap-2 mb-4 pb-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value ?? 'all'}
              onClick={() => setTypeFilter(opt.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                typeFilter === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && (
          <p className="text-sm text-[var(--color-status-critical)] text-center py-8">
            {error}
          </p>
        )}

        {/* Empty state */}
        {!loading && !error && transactions.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-12">
            No transactions yet
          </p>
        )}

        {/* Transaction list */}
        {!loading && !error && transactions.length > 0 && (
          <ul className="space-y-3">
            {transactions.map((tx) => {
              const { sign, color } = getQuantitySignAndColor(tx.type);
              const displayQuantity =
                sign === ''
                  ? tx.quantity
                  : `${sign}${Math.abs(tx.quantity)}`;

              return (
                <li
                  key={tx.id}
                  className="rounded-xl border bg-card p-4 flex items-start justify-between"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {tx.inventoryItem?.name ?? 'Unknown item'}
                    </p>
                    {tx.note && (
                      <p className="text-sm text-[var(--color-text-muted)] truncate mt-0.5">
                        {tx.note}
                      </p>
                    )}
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      {new Date(tx.createdAt).toLocaleDateString('en-GB')}{' '}
                      {new Date(tx.createdAt).toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span
                      className={`inline-block text-xs font-medium px-2 py-1 rounded-full ${
                        TYPE_COLORS[tx.type] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {tx.type}
                    </span>
                    <p className={`text-sm font-semibold mt-1 ${color}`}>
                      {displayQuantity}{' '}
                      {tx.inventoryItem?.unit ?? ''}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
