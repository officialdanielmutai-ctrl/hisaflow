'use client';

import { useState } from 'react';
import { useTransactionHistory } from '@/hooks/useTransactionHistory';
import AppShell from '@/components/layout/AppShell';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { Badge } from '@/components/ui/badge';
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

export default function TransactionsPage() {
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const { transactions, loading, error } = useTransactionHistory({
    type: typeFilter,
  });
  const { membership } = useMyOrganization();

  return (
    <AppShell
      activeTab="transactions"
      businessName={membership?.organization.name ?? 'Hisaflow'}
    >
      <div className="p-4">
        {/* Page header */}
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">
          Transactions
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Your full activity log
        </p>

        {/* Filter row */}
        <div className="flex flex-wrap gap-2 mb-4">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value ?? 'all'}
              onClick={() => setTypeFilter(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                typeFilter === opt.value
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]'
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
          <p className="text-sm text-[var(--color-status-critical)]">
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
              const isPositive =
                tx.type === 'PURCHASE' || tx.type === 'RETURN';
              const isNeutral = tx.type === 'ADJUSTMENT';
              const qtySign = isPositive ? '+' : isNeutral ? '' : '-';

              return (
                <li
                  key={tx.id}
                  className="p-4 rounded-xl bg-[var(--color-bg-surface)] shadow-sm flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {tx.inventoryItem?.name ?? 'Unknown item'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge
                        variant="outline"
                        className={TYPE_COLORS[tx.type] ?? 'bg-gray-100 text-gray-700'}
                      >
                        {tx.type}
                      </Badge>
                      {tx.note && (
                        <span className="text-xs text-[var(--color-text-muted)] truncate">
                          {tx.note}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      {new Date(tx.createdAt).toLocaleDateString('en-GB')}{' '}
                      {new Date(tx.createdAt).toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="ml-3 text-right">
                    <span
                      className={`text-sm font-semibold ${
                        isPositive
                          ? 'text-[var(--color-status-success)]'
                          : isNeutral
                          ? 'text-[var(--color-text-secondary)]'
                          : 'text-[var(--color-status-critical)]'
                      }`}
                    >
                      {qtySign}
                      {tx.quantity} {tx.inventoryItem?.unit ?? ''}
                    </span>
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
