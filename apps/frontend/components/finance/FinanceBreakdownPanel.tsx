'use client';

import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import {
  getCategoryLabel,
  type FinanceBreakdown,
} from '@/services/business-finance.service';

function formatKES(value: number | null | undefined) {
  if (value == null) return '—';
  return `KES ${value.toLocaleString('en-KE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function labelFor(groupKey: string, key: string, fallback: string) {
  if (groupKey === 'expenses-by-category') return getCategoryLabel(key);
  return fallback;
}

/**
 * Vertical-aware finance breakdown. The same component renders for every
 * business type; the backend decides which groups exist (revenue by room, by
 * plan, by class, by commodity, expenses, leaks).
 */
export function FinanceBreakdownPanel({ breakdown }: { breakdown: FinanceBreakdown }) {
  const netPositive = breakdown.netProfit >= 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Period P&L */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Revenue
          </p>
          <p className="mt-1 text-base font-black text-[var(--color-text-primary)]">
            {formatKES(breakdown.revenue)}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Cost of sales
          </p>
          <p className="mt-1 text-base font-black text-[var(--color-text-primary)]">
            {formatKES(breakdown.cogs)}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Gross profit
          </p>
          <p className="mt-1 text-base font-black text-[var(--color-accent)]">
            {formatKES(breakdown.grossProfit)}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Running costs
          </p>
          <p className="mt-1 text-base font-black text-[var(--color-text-primary)]">
            {formatKES(breakdown.operatingExpenses)}
          </p>
        </div>
      </div>

      <div
        className={`flex items-center justify-between rounded-2xl border p-4 ${
          netPositive
            ? 'border-emerald-400/30 bg-emerald-500/5'
            : 'border-red-400/30 bg-red-500/5'
        }`}
      >
        <div className="flex items-center gap-2">
          {netPositive ? (
            <TrendingUp className="h-5 w-5 text-emerald-600" />
          ) : (
            <TrendingDown className="h-5 w-5 text-red-500" />
          )}
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
            Net profit (all income accounted for)
          </span>
        </div>
        <span
          className={`text-lg font-black ${netPositive ? 'text-emerald-600' : 'text-red-500'}`}
        >
          {formatKES(breakdown.netProfit)}
        </span>
      </div>

      {/* Per-vertical groups */}
      {breakdown.breakdowns.map((group) => {
        const max = Math.max(...group.rows.map((row) => Math.abs(row.amount)), 1);
        return (
          <div
            key={group.key}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4"
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {group.title}
            </p>
            <div className="flex flex-col gap-2">
              {group.rows.map((row) => (
                <div key={`${group.key}-${row.key}`}>
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-[var(--color-text-primary)]">
                      {labelFor(group.key, row.key, row.label)}
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-[var(--color-text-primary)]">
                      {formatKES(row.amount)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-base)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-accent)]"
                      style={{ width: `${Math.max(2, (Math.abs(row.amount) / max) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Leaks */}
      {breakdown.leaks.length > 0 && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-50/50 p-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700">
            <AlertTriangle className="h-4 w-4" />
            Where money is leaking
          </p>
          <div className="flex flex-col gap-2">
            {breakdown.leaks.map((leak) => (
              <div key={leak.key} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                    {leak.label}
                  </p>
                  {leak.detail && (
                    <p className="text-[10px] leading-snug text-[var(--color-text-secondary)]">
                      {leak.detail}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs font-bold text-amber-700">
                  {formatKES(leak.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
