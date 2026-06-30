'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import {
  getFinanceOverview,
  getItemFinancialProfile,
  getFinanceForecast,
  getPriceSuggestions,
  type FinanceOverview,
  type ItemFinancialProfile,
  type ForecastInsight,
  type PriceSuggestion,
} from '@/services/finance.service';
import { getInventoryItems, type InventoryItem } from '@/services/inventory.service';
import dynamic from 'next/dynamic';
import { TrendingUp, TrendingDown, Minus, AlertCircle, Tag, Search } from 'lucide-react';
import PriceReviewSheet from '@/components/system/PriceReviewSheet';

const RevenueChart = dynamic(() => import('@/components/charts/RevenueChart'), { ssr: false });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatKES(v: number | null | undefined) {
  if (v == null) return '—';
  return `KES ${v.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatPct(v: number | null | undefined) {
  if (v == null) return '—';
  return `${v.toFixed(1)}%`;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'green' | 'red' | 'blue' | 'purple';
}) {
  const colors = {
    green: 'from-green-500/10 to-green-500/5 border-green-400/30',
    red: 'from-red-500/10 to-red-500/5 border-red-400/30',
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-400/30',
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-400/30',
  };
  const textColors = {
    green: 'text-green-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
  };

  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br p-4 ${accent ? colors[accent] : 'border-[var(--color-border)]'}`}
    >
      <p className="text-xs text-[var(--color-text-secondary)] mb-1">{label}</p>
      <p className={`text-xl font-bold ${accent ? textColors[accent] : ''}`}>{value}</p>
      {sub && <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{sub}</p>}
    </div>
  );
}

function InsightCard({ insight }: { insight: ForecastInsight }) {
  const colors = {
    POSITIVE: 'border-green-400/40 bg-green-50/60',
    NEGATIVE: 'border-red-400/40 bg-red-50/60',
    NEUTRAL: 'border-blue-300/40 bg-blue-50/40',
  };
  const icons = {
    POSITIVE: <TrendingUp className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />,
    NEGATIVE: <TrendingDown className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />,
    NEUTRAL: <Minus className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />,
  };

  return (
    <div className={`rounded-2xl border p-4 ${colors[insight.sentiment]}`}>
      <div className="flex items-start gap-2 mb-1">
        {icons[insight.sentiment]}
        <p className="font-semibold text-sm">{insight.title}</p>
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{insight.body}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();

  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [forecast, setForecast] = useState<ForecastInsight[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ItemFinancialProfile | null>(null);
  const [suggestions, setSuggestions] = useState<PriceSuggestion[]>([]);
  const [showPriceSheet, setShowPriceSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [loadingItem, setLoadingItem] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orgId = membership?.organization.id;

  // Load overview on mount
  useEffect(() => {
    if (!orgId) return;
    async function load() {
      try {
        const token = await getToken();
        if (!token) return;
        const [ov, inv] = await Promise.all([
          getFinanceOverview(token, orgId!),
          getInventoryItems(token, orgId!),
        ]);
        setOverview(ov);
        setItems(inv);
      } catch (e) {
        setError('Could not load financial data.');
      } finally {
        setLoadingOverview(false);
      }
    }
    load();
  }, [orgId, getToken]);

  // Load forecast lazily
  const loadForecast = useCallback(async () => {
    if (!orgId || forecast.length > 0) return;
    setLoadingForecast(true);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await getFinanceForecast(token, orgId);
      setForecast(result.insights);
    } catch { /* fallback handled server-side */ }
    finally { setLoadingForecast(false); }
  }, [orgId, getToken, forecast.length]);

  // Load price suggestions
  const loadSuggestions = useCallback(async () => {
    if (!orgId) return;
    setLoadingSuggestions(true);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await getPriceSuggestions(token, orgId);
      setSuggestions(result);
      setShowPriceSheet(true);
    } catch { } finally { setLoadingSuggestions(false); }
  }, [orgId, getToken]);

  // Select item for drill-down
  const handleSelectItem = async (item: InventoryItem) => {
    if (!orgId) return;
    setLoadingItem(true);
    setSelectedItem(null);
    try {
      const token = await getToken();
      if (!token) return;
      const profile = await getItemFinancialProfile(item.id, token, orgId);
      setSelectedItem(profile);
    } catch { } finally { setLoadingItem(false); }
  };

  const filteredItems = items.filter((i) =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (loadingOverview) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Finance</h1>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-sm text-[var(--color-text-secondary)]">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Finance</h1>
        {(overview?.unpricedCount ?? 0) > 0 && (
          <button
            onClick={loadSuggestions}
            disabled={loadingSuggestions}
            className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200 transition-colors"
          >
            <Tag className="h-3.5 w-3.5" />
            {loadingSuggestions ? 'Loading...' : `${overview?.unpricedCount} unpriced`}
          </button>
        )}
      </div>

      {/* KPI Cards */}
      {overview && (
        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            label="Inventory Value"
            value={formatKES(overview.totalInventoryValue)}
            sub="at cost price"
            accent="blue"
          />
          <KpiCard
            label="Potential Revenue"
            value={formatKES(overview.totalPotentialRevenue)}
            sub="if all stock sold"
            accent="purple"
          />
          <KpiCard
            label="30-Day Revenue"
            value={formatKES(overview.totalRevenue)}
            sub="from sales"
            accent="green"
          />
          <KpiCard
            label="30-Day Profit"
            value={formatKES(overview.totalProfit)}
            sub={overview.grossMarginPct != null ? `${formatPct(overview.grossMarginPct)} margin` : undefined}
            accent={overview.totalProfit >= 0 ? 'green' : 'red'}
          />
        </div>
      )}

      {/* Revenue & Profit Chart */}
      <div className="rounded-2xl border border-[var(--color-border)] p-4">
        <p className="font-semibold text-sm mb-3">Revenue vs Profit (30 Days)</p>
        <RevenueChart data={overview?.dailyTrend ?? []} />
      </div>

      {/* AI Forecast */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-sm">CFO Insights</p>
          {forecast.length === 0 && (
            <button
              onClick={loadForecast}
              disabled={loadingForecast}
              className="text-xs font-medium text-[var(--color-accent)] hover:underline"
            >
              {loadingForecast ? 'Analysing...' : 'Generate Analysis'}
            </button>
          )}
        </div>
        {loadingForecast && (
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        )}
        {forecast.length > 0 && (
          <div className="flex flex-col gap-3">
            {forecast.map((ins, i) => (
              <InsightCard key={i} insight={ins} />
            ))}
          </div>
        )}
        {!loadingForecast && forecast.length === 0 && (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Tap "Generate Analysis" to get your personalised financial insights.
          </p>
        )}
      </div>

      {/* Item Drill-Down */}
      <div>
        <p className="font-semibold text-sm mb-3">Commodity Breakdown</p>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search an item..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>

        {/* Item list */}
        {searchQuery && (
          <div className="flex flex-col gap-2 mb-4 max-h-52 overflow-y-auto">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelectItem(item)}
                className="flex items-center justify-between rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-left hover:border-[var(--color-accent)] transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {item.quantity} {item.unit} · {item.sellingPrice ? `KES ${item.sellingPrice}` : 'No price set'}
                  </p>
                </div>
                <span className="text-xs text-[var(--color-accent)]">View →</span>
              </button>
            ))}
            {filteredItems.length === 0 && (
              <p className="text-sm text-[var(--color-text-secondary)] text-center py-4">No items found.</p>
            )}
          </div>
        )}

        {/* Item Profile */}
        {loadingItem && <div className="h-40 animate-pulse rounded-2xl bg-muted" />}
        {selectedItem && !loadingItem && (
          <div className="rounded-2xl border border-[var(--color-border)] p-4 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-base">{selectedItem.name}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {selectedItem.currentStock} {selectedItem.unit} in stock
                </p>
              </div>
              <button onClick={() => setSelectedItem(null)} className="text-xs text-[var(--color-text-muted)]">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Stock Value" value={formatKES(selectedItem.stockValue)} accent="blue" />
              <KpiCard label="Gross Margin" value={formatPct(selectedItem.grossMarginPct)} accent={selectedItem.grossMarginPct != null && selectedItem.grossMarginPct > 0 ? 'green' : 'red'} />
              <KpiCard label="All-Time Revenue" value={formatKES(selectedItem.totalRevenue)} accent="purple" />
              <KpiCard label="All-Time Profit" value={formatKES(selectedItem.totalProfit)} accent={selectedItem.totalProfit >= 0 ? 'green' : 'red'} />
            </div>

            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">Revenue vs Profit (30 Days)</p>
              <RevenueChart data={selectedItem.dailyTrend} />
            </div>

            {selectedItem.costPrice != null && selectedItem.sellingPrice != null && (
              <div className="rounded-xl bg-[var(--color-bg-base)] p-3 text-xs text-[var(--color-text-secondary)]">
                <p>Cost: <strong>KES {selectedItem.costPrice}</strong> · Sell: <strong>KES {selectedItem.sellingPrice}</strong></p>
                <p className="mt-0.5">
                  Profit per unit: <strong className={selectedItem.sellingPrice > selectedItem.costPrice ? 'text-green-600' : 'text-red-600'}>
                    KES {(selectedItem.sellingPrice - selectedItem.costPrice).toFixed(2)}
                  </strong>
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Price Review Sheet */}
      {showPriceSheet && suggestions.length > 0 && (
        <PriceReviewSheet
          suggestions={suggestions}
          onClose={() => setShowPriceSheet(false)}
          onConfirmed={() => {
            setShowPriceSheet(false);
            // Reload overview to reflect new prices
            setLoadingOverview(true);
            getToken().then((token) => {
              if (token && orgId) {
                getFinanceOverview(token, orgId).then((ov) => {
                  setOverview(ov);
                  setLoadingOverview(false);
                });
              }
            });
          }}
        />
      )}
    </div>
  );
}
