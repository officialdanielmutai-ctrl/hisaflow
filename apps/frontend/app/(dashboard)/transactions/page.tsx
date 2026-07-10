'use client';

import { useState } from 'react';
import { useTransactionHistory } from '@/hooks/useTransactionHistory';
import { type TransactionType } from '@/services/transactions.service';
import { ArrowDownLeft, ArrowUpRight, SlidersHorizontal, PackageOpen } from 'lucide-react';
import { useRole } from '@/hooks/useRole';


// ─── Helpers ────────────────────────────────────────────────────────────────

const TYPE_META: Record<
  string,
  { label: string; sign: '+' | '-' | ''; colorClass: string; iconClass: string }
> = {
  SALE:       { label: 'Sale',       sign: '-', colorClass: 'text-red-600',   iconClass: 'bg-red-100'    },
  PURCHASE:   { label: 'Purchase',   sign: '+', colorClass: 'text-green-600', iconClass: 'bg-green-100'  },
  ADJUSTMENT: { label: 'Adjustment', sign: '',  colorClass: 'text-blue-600',  iconClass: 'bg-blue-100'   },
  WASTAGE:    { label: 'Wastage',    sign: '-', colorClass: 'text-orange-600',iconClass: 'bg-orange-100' },
};

const FILTER_OPTIONS: { label: string; value: TransactionType | undefined }[] = [
  { label: 'All',        value: undefined    },
  { label: 'Sale',       value: 'SALE'       },
  { label: 'Purchase',   value: 'PURCHASE'   },
  { label: 'Adjustment', value: 'ADJUSTMENT' },
  { label: 'Wastage',    value: 'WASTAGE'    },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
    ' · ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const [typeFilter, setTypeFilter] = useState<TransactionType | undefined>(undefined);
  const { transactions, loading, error } = useTransactionHistory({ type: typeFilter });
  const { isStaff } = useRole();

  // Staff members cannot view the full transaction log
  if (isStaff) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="text-5xl">🔒</div>
        <h2 className="text-xl font-bold">Access Restricted</h2>
        <p className="text-sm text-[var(--color-text-secondary)] max-w-xs">
          The transaction log is only available to business owners and managers.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Transactions</h1>
        <SlidersHorizontal className="h-5 w-5 text-[var(--color-text-muted)]" />
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            onClick={() => setTypeFilter(opt.value)}
            className={`flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              typeFilter === opt.value
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-muted text-[var(--color-text-secondary)]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[72px] w-full animate-pulse rounded-2xl bg-muted"
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="py-12 text-center text-sm text-[var(--color-text-secondary)]">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && transactions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <PackageOpen className="mb-4 h-12 w-12 text-[var(--color-text-muted)]" />
          <p className="font-semibold text-[var(--color-text-primary)]">No transactions yet</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {typeFilter ? `No ${typeFilter.toLowerCase()} records found` : 'Log a transaction from the Inventory tab'}
          </p>
        </div>
      )}

      {/* Transaction list */}
      {!loading && !error && transactions.length > 0 && (
        <ul className="flex flex-col gap-3">
          {transactions.map((tx) => {
            const meta = TYPE_META[tx.type] ?? { label: tx.type, sign: '', colorClass: 'text-[var(--color-text-primary)]', iconClass: 'bg-muted' };
            const isOutflow = meta.sign === '-';

            return (
              <li
                key={tx.id}
                className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4"
              >
                {/* Direction icon */}
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${meta.iconClass}`}>
                  {isOutflow
                    ? <ArrowUpRight className={`h-5 w-5 ${meta.colorClass}`} />
                    : <ArrowDownLeft className={`h-5 w-5 ${meta.colorClass}`} />
                  }
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                    {tx.inventoryItem?.name ?? 'Unknown item'}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    <span className="inline-flex items-center gap-1">
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${meta.iconClass} ${meta.colorClass}`}>
                        {meta.label}
                      </span>
                      {tx.note && <span className="truncate">· {tx.note}</span>}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
                    {formatDate(tx.createdAt)}
                  </p>
                </div>

                {/* Quantity */}
                <div className="flex-shrink-0 text-right">
                  <p className={`text-base font-bold ${meta.colorClass}`}>
                    {meta.sign}{Math.abs(tx.quantity)} {tx.inventoryItem?.unit ?? ''}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
