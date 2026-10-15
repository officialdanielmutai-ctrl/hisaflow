'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Loader2, Search } from 'lucide-react';
import {
  searchFinances,
  type FinanceSearchResult,
} from '@/services/business-finance.service';
import {
  FINANCE_ATTRIBUTE_META,
  financeAttributeTitle,
} from '@/lib/finance-search';

const EXAMPLE_QUERIES = ['Room', 'Repairs', 'Wastage', 'Salary', 'Unpaid', 'Plan'];

function formatKES(value: number) {
  return `KES ${value.toLocaleString('en-KE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/**
 * Searchable view of the business's financial attributes — the finance
 * equivalent of the commodity breakdown. Typing filters rooms, plans, classes,
 * commodities, expenses, leaks, unpaid credit and ledger entries; an empty
 * query shows the largest attributes so the user can browse.
 */
export function FinanceExplorer({
  orgId,
  getToken,
}: {
  orgId: string;
  getToken: () => Promise<string | null>;
}) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(handle);
  }, [query]);

  const { data, isLoading } = useSWR<FinanceSearchResult>(
    orgId ? ['finance-search', orgId, debounced] : null,
    async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return searchFinances(token, orgId, debounced);
    },
  );

  const results = data?.results ?? [];

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="font-semibold text-sm">Financial explorer</p>
        {data && (
          <span className="text-xs text-[var(--color-text-muted)]">
            {data.totalMatched} match{data.totalMatched === 1 ? '' : 'es'}
          </span>
        )}
      </div>
      <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
        Search an attribute of your business — a room, plan, class, item, expense,
        client or leak.
      </p>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input
          type="text"
          placeholder="Search your finances…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
      </div>

      {!query && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {EXAMPLE_QUERIES.map((example) => (
            <button
              key={example}
              onClick={() => setQuery(example)}
              className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-elevated)]"
            >
              {example}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--color-accent)]" />
        </div>
      ) : results.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--color-text-secondary)]">
          No matching financial attribute.
        </p>
      ) : (
        <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {results.map((attribute) => {
            const meta = FINANCE_ATTRIBUTE_META[attribute.type];
            return (
              <div
                key={attribute.id}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  <span className="text-lg leading-none">{meta.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                        {financeAttributeTitle(attribute)}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${meta.badge}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                    {attribute.subtitle && (
                      <p className="truncate text-xs text-[var(--color-text-secondary)]">
                        {attribute.subtitle}
                      </p>
                    )}
                    {attribute.detail && attribute.detail !== attribute.subtitle && (
                      <p className="truncate text-[10px] text-[var(--color-text-muted)]">
                        {attribute.detail}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">
                      {formatKES(attribute.amount)}
                    </p>
                    {attribute.sharePct != null && (
                      <p className="text-[10px] text-[var(--color-text-muted)]">
                        {attribute.sharePct}% of total
                      </p>
                    )}
                  </div>
                </div>
                {attribute.sharePct != null && (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--color-bg-base)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-accent)]"
                      style={{ width: `${Math.min(100, Math.max(2, attribute.sharePct))}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
