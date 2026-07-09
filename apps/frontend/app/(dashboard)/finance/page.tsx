'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import {
  getFinanceForecast,
  getPriceSuggestions,
  getItemFinancialProfile,
  type ForecastInsight,
  type PriceSuggestion,
  type ItemFinancialProfile,
} from '@/services/finance.service';
import {
  getBusinessOverview,
  getBusinessTransactions,
  createBusinessTransaction,
  updateBusinessTransaction,
  deleteBusinessTransaction,
  getCategoryLabel,
  getCategoryEmoji,
  type BusinessOverview,
  type BusinessTransactionRecord,
} from '@/services/business-finance.service';
import { getInventoryItems } from '@/services/inventory.service';
import dynamic from 'next/dynamic';
import {
  TrendingUp, TrendingDown, Minus, AlertCircle, Tag,
  Search, Plus, Trash2, RotateCcw, RefreshCw, ChevronRight,
  ArrowDownLeft, ArrowUpRight, Edit2,
} from 'lucide-react';
import PriceReviewSheet from '@/components/system/PriceReviewSheet';
import AddEntrySheet from '@/components/finance/AddEntrySheet';

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
function pctChange(curr: number, prev: number) {
  if (prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string;
  accent?: 'green' | 'red' | 'blue' | 'purple' | 'amber';
}) {
  const colors: Record<string, string> = {
    green: 'from-green-500/10 to-green-500/5 border-green-400/30',
    red: 'from-red-500/10 to-red-500/5 border-red-400/30',
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-400/30',
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-400/30',
    amber: 'from-amber-500/10 to-amber-500/5 border-amber-400/30',
  };
  const textColors: Record<string, string> = {
    green: 'text-green-600', red: 'text-red-600', blue: 'text-blue-600',
    purple: 'text-purple-600', amber: 'text-amber-600',
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 ${accent ? colors[accent] : 'border-[var(--color-border)]'}`}>
      <p className="text-xs text-[var(--color-text-secondary)] mb-1">{label}</p>
      <p className={`text-xl font-bold ${accent ? textColors[accent] : ''}`}>{value}</p>
      {sub && <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{sub}</p>}
    </div>
  );
}

function InsightCard({ insight }: { insight: ForecastInsight }) {
  const colors = { POSITIVE: 'border-green-400/40 bg-green-50/60', NEGATIVE: 'border-red-400/40 bg-red-50/60', NEUTRAL: 'border-blue-300/40 bg-blue-50/40' };
  const icons = { POSITIVE: <TrendingUp className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />, NEGATIVE: <TrendingDown className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />, NEUTRAL: <Minus className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" /> };
  return (
    <div className={`rounded-2xl border p-4 ${colors[insight.sentiment]}`}>
      <div className="flex items-start gap-2 mb-1">{icons[insight.sentiment]}<p className="font-semibold text-sm">{insight.title}</p></div>
      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{insight.body}</p>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ orgId, getToken }: { orgId: string; getToken: () => Promise<string | null> }) {
  const [forecast, setForecast] = useState<ForecastInsight[]>([]);
  const [dateMode, setDateMode] = useState<'rolling30' | 'calendar'>('rolling30');
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [suggestions, setSuggestions] = useState<PriceSuggestion[]>([]);
  const [showPriceSheet, setShowPriceSheet] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const fetchOverview = async () => {
    const token = await getToken();
    if (!token) throw new Error('No token');
    return getBusinessOverview(token, orgId, dateMode);
  };

  const { data: overview, error: fetchError, isLoading: loading, mutate: load } = useSWR(
    orgId ? ['overview', orgId, dateMode] : null,
    fetchOverview
  );

  const error = fetchError ? 'Could not load financial data.' : null;

  const loadForecast = useCallback(async () => {
    if (forecast.length > 0) return;
    setLoadingForecast(true);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await getFinanceForecast(token, orgId);
      setForecast(result.insights);
    } catch { } finally { setLoadingForecast(false); }
  }, [orgId, getToken, forecast.length]);

  const loadSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await getPriceSuggestions(token, orgId);
      setSuggestions(result);
      setShowPriceSheet(true);
    } catch { } finally { setLoadingSuggestions(false); }
  }, [orgId, getToken]);

  if (loading) return (
    <div className="flex flex-col gap-4 pt-2">
      {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <AlertCircle className="h-10 w-10 text-red-400" />
      <p className="text-sm text-[var(--color-text-secondary)]">{error}</p>
    </div>
  );

  const thisMonthPct = overview ? pctChange(overview.thisMonth.netProfit, overview.lastMonth.netProfit) : null;

  return (
    <div className="flex flex-col gap-5 pt-2">
      {/* Date mode toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setDateMode('rolling30')}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${dateMode === 'rolling30' ? 'bg-[var(--color-accent)] text-white' : 'border border-[var(--color-border)] text-[var(--color-text-secondary)]'}`}
        >
          Rolling 30d
        </button>
        <button
          onClick={() => setDateMode('calendar')}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${dateMode === 'calendar' ? 'bg-[var(--color-accent)] text-white' : 'border border-[var(--color-border)] text-[var(--color-text-secondary)]'}`}
        >
          This Month
        </button>
        {(overview?.unpricedCount ?? 0) > 0 && (
          <button onClick={loadSuggestions} disabled={loadingSuggestions}
            className="ml-auto flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-200 transition-colors">
            <Tag className="h-3 w-3" />
            {loadingSuggestions ? '…' : `${overview?.unpricedCount} unpriced`}
          </button>
        )}
      </div>

      {/* Hero: Net Profit */}
      {overview && (
        <div className={`rounded-2xl p-5 border ${overview.netProfit >= 0 ? 'from-emerald-500/15 to-emerald-500/5 border-emerald-400/30 bg-gradient-to-br' : 'from-red-500/15 to-red-500/5 border-red-400/30 bg-gradient-to-br'}`}>
          <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Net Profit (after all costs)</p>
          <p className={`text-3xl font-black ${overview.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatKES(overview.netProfit)}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <p className="text-xs text-[var(--color-text-secondary)]">
              {formatPct(overview.netMarginPct)} net margin
            </p>
            {thisMonthPct !== null && (
              <span className={`text-xs font-semibold ${thisMonthPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {thisMonthPct >= 0 ? '↑' : '↓'} {Math.abs(thisMonthPct).toFixed(1)}% vs last month
              </span>
            )}
          </div>
        </div>
      )}

      {/* KPI Grid */}
      {overview && (
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Gross Revenue" value={formatKES(overview.grossRevenue)} sub="from sales" accent="blue" />
          <KpiCard label="Gross Profit" value={formatKES(overview.grossProfit)} sub={`${formatPct(overview.grossMarginPct)} margin`} accent={overview.grossProfit >= 0 ? 'green' : 'red'} />
          <KpiCard label="Operating Costs" value={formatKES(overview.totalOperatingExpenses)} sub="rent, salaries, bills…" accent="red" />
          <KpiCard label="Inventory Value" value={formatKES(overview.totalInventoryValue)} sub="at cost price" accent="purple" />
        </div>
      )}

      {/* Month comparison */}
      {overview && (
        <div className="rounded-2xl border border-[var(--color-border)] p-4">
          <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-3">Month Comparison</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {['Revenue', 'Expenses', 'Net Profit'].map((label, i) => {
              const thisVal = i === 0 ? overview.thisMonth.revenue : i === 1 ? overview.thisMonth.expenses : overview.thisMonth.netProfit;
              const lastVal = i === 0 ? overview.lastMonth.revenue : i === 1 ? overview.lastMonth.expenses : overview.lastMonth.netProfit;
              const pct = pctChange(thisVal, lastVal);
              return (
                <div key={label}>
                  <p className="text-[10px] text-[var(--color-text-secondary)] mb-0.5">{label}</p>
                  <p className="text-sm font-bold">{formatKES(thisVal)}</p>
                  {pct !== null && (
                    <p className={`text-[10px] font-semibold ${(i === 1 ? pct <= 0 : pct >= 0) ? 'text-emerald-600' : 'text-red-500'}`}>
                      {pct >= 0 ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}%
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expense breakdown */}
      {overview && overview.expensesByCategory.length > 0 && (
        <div className="rounded-2xl border border-[var(--color-border)] p-4">
          <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-3">Expenses by Category</p>
          <div className="flex flex-col gap-2">
            {overview.expensesByCategory.map((cat) => {
              const pct = overview.totalOperatingExpenses > 0 ? (cat.total / overview.totalOperatingExpenses) * 100 : 0;
              return (
                <div key={cat.category}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs">{getCategoryEmoji(cat.category)} {getCategoryLabel(cat.category)}</span>
                    <span className="text-xs font-semibold">{formatKES(cat.total)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--color-bg-base)] overflow-hidden">
                    <div className="h-full rounded-full bg-red-400" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Revenue chart */}
      <div className="rounded-2xl border border-[var(--color-border)] p-4">
        <p className="font-semibold text-sm mb-3">Revenue vs Profit (trend)</p>
        <RevenueChart data={overview?.dailyTrend ?? []} />
      </div>

      {/* AI CFO Insights */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-sm">CFO Insights</p>
          {forecast.length === 0 && (
            <button onClick={loadForecast} disabled={loadingForecast}
              className="text-xs font-medium text-[var(--color-accent)] hover:underline">
              {loadingForecast ? 'Analysing…' : 'Generate Analysis'}
            </button>
          )}
        </div>
        {loadingForecast && <div className="h-24 animate-pulse rounded-2xl bg-muted" />}
        {forecast.length > 0 && (
          <div className="flex flex-col gap-3">{forecast.map((ins, i) => <InsightCard key={i} insight={ins} />)}</div>
        )}
        {!loadingForecast && forecast.length === 0 && (
          <p className="text-sm text-[var(--color-text-secondary)]">Tap "Generate Analysis" for personalised financial insights.</p>
        )}
      </div>

      {showPriceSheet && suggestions.length > 0 && (
        <PriceReviewSheet suggestions={suggestions} onClose={() => setShowPriceSheet(false)}
          onConfirmed={() => { setShowPriceSheet(false); load(); }} />
      )}
    </div>
  );
}

// ─── Expenses Tab ─────────────────────────────────────────────────────────────

function ExpensesTab({ orgId, getToken }: { orgId: string; getToken: () => Promise<string | null> }) {
  const fetchExpenses = async () => {
    const token = await getToken();
    if (!token) throw new Error('No token');
    return getBusinessTransactions(token, orgId);
  };

  const { data: entries = [], isLoading: loading, mutate: load } = useSWR(
    orgId ? ['expenses', orgId] : null,
    fetchExpenses
  );

  const [filter, setFilter] = useState<'ALL' | 'EXPENSE' | 'INCOME'>('ALL');
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BusinessTransactionRecord | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleSave = async (payload: any) => {
    const token = await getToken();
    if (!token) return;
    await createBusinessTransaction(payload, token, orgId);
    await load();
  };

  const handleUpdate = async (payload: any) => {
    if (!editingEntry) return;
    const token = await getToken();
    if (!token) return;
    await updateBusinessTransaction(editingEntry.id, payload, token, orgId);
    await load();
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const token = await getToken();
      if (!token) return;
      await deleteBusinessTransaction(id, token, orgId);
      load();
    } catch { } finally { setDeleting(null); }
  };

  const filtered = filter === 'ALL' ? entries : entries.filter((e) => e.type === filter);
  const totalExpenses = entries.filter((e) => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0);
  const totalIncome = entries.filter((e) => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0);

  return (
    <div className="flex flex-col gap-4 pt-2">
      {/* Totals + Add */}
      <div className="flex items-stretch gap-3">
        <div className="flex-1 rounded-2xl border border-red-400/30 bg-red-50/60 p-3 text-center">
          <p className="text-[10px] text-red-600 font-semibold mb-0.5">Total Expenses</p>
          <p className="text-base font-black text-red-600">{formatKES(totalExpenses)}</p>
        </div>
        <div className="flex-1 rounded-2xl border border-emerald-400/30 bg-emerald-50/60 p-3 text-center">
          <p className="text-[10px] text-emerald-600 font-semibold mb-0.5">Other Income</p>
          <p className="text-base font-black text-emerald-600">{formatKES(totalIncome)}</p>
        </div>
        <button
          onClick={() => setShowAddSheet(true)}
          className="flex items-center justify-center rounded-2xl bg-[var(--color-accent)] px-4 text-white shadow-md hover:opacity-90 transition-opacity"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2">
        {(['ALL', 'EXPENSE', 'INCOME'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${filter === f ? 'bg-[var(--color-accent)] text-white' : 'border border-[var(--color-border)] text-[var(--color-text-secondary)]'}`}>
            {f === 'ALL' ? 'All' : f === 'EXPENSE' ? '↑ Expenses' : '↓ Income'}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <span className="text-4xl">📋</span>
          <p className="font-semibold">No entries yet</p>
          <p className="text-sm text-[var(--color-text-secondary)]">Tap the + button to log your first expense or income.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((entry) => (
            <div key={entry.id}
              className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3">
              <div className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${entry.type === 'EXPENSE' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                <span className="text-base">{getCategoryEmoji(entry.category)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold truncate">
                    {getCategoryLabel(entry.category)}
                    {entry.staffName && <span className="font-normal text-[var(--color-text-secondary)]"> – {entry.staffName}</span>}
                  </p>
                  {entry.isRecurring && (
                    <span className="text-[10px] rounded-full bg-blue-100 text-blue-600 px-1.5 py-0.5 font-semibold flex items-center gap-0.5">
                      <RotateCcw className="h-2.5 w-2.5" />{entry.recurrenceRule?.toLowerCase()}
                    </span>
                  )}
                </div>
                {entry.description && <p className="text-xs text-[var(--color-text-secondary)] truncate">{entry.description}</p>}
                <p className="text-xs text-[var(--color-text-muted)]">{entry.date}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-bold ${entry.type === 'EXPENSE' ? 'text-red-500' : 'text-emerald-600'}`}>
                  {entry.type === 'EXPENSE' ? '-' : '+'}{formatKES(entry.amount)}
                </p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  <button onClick={() => setEditingEntry(entry)}
                    className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(entry.id)} disabled={deleting === entry.id}
                    className="p-1 text-[var(--color-text-muted)] hover:text-red-500 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddSheet && <AddEntrySheet onClose={() => setShowAddSheet(false)} onSave={handleSave} />}
      {editingEntry && (
        <AddEntrySheet
          onClose={() => setEditingEntry(null)}
          onUpdate={handleUpdate}
          initialValues={editingEntry}
        />
      )}
    </div>
  );
}

// ─── Ledger Tab ───────────────────────────────────────────────────────────────

function LedgerTab({ orgId, getToken }: { orgId: string; getToken: () => Promise<string | null> }) {
  const fetchLedger = async () => {
    const token = await getToken();
    if (!token) throw new Error('No token');
    const [bizData, invItems] = await Promise.all([
      getBusinessTransactions(token, orgId),
      getInventoryItems(token, orgId),
    ]);
    return { entries: bizData, items: invItems };
  };

  const { data, isLoading: loading } = useSWR(
    orgId ? ['ledger', orgId] : null,
    fetchLedger
  );

  const entries = data?.entries ?? [];
  const items = data?.items ?? [];

  const [typeFilter, setTypeFilter] = useState<'ALL' | 'EXPENSE' | 'INCOME'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<ItemFinancialProfile | null>(null);
  const [loadingItem, setLoadingItem] = useState(false);

  const handleSelectItem = async (item: any) => {
    setLoadingItem(true);
    setSelectedItem(null);
    try {
      const token = await getToken();
      if (!token) return;
      const profile = await getItemFinancialProfile(item.id, token, orgId);
      setSelectedItem(profile);
    } catch { } finally { setLoadingItem(false); }
  };

  const filtered = typeFilter === 'ALL' ? entries : entries.filter((e) => e.type === typeFilter);
  const filteredItems = items.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex flex-col gap-4 pt-2">
      {/* Filter chips */}
      <div className="flex gap-2">
        {(['ALL', 'EXPENSE', 'INCOME'] as const).map((f) => (
          <button key={f} onClick={() => setTypeFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${typeFilter === f ? 'bg-[var(--color-accent)] text-white' : 'border border-[var(--color-border)] text-[var(--color-text-secondary)]'}`}>
            {f === 'ALL' ? 'All Entries' : f === 'EXPENSE' ? '↑ Expenses' : '↓ Income'}
          </button>
        ))}
      </div>

      {/* Business entries */}
      {loading ? (
        <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-center text-[var(--color-text-secondary)] py-8">No ledger entries yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] px-4 py-2.5">
              {entry.type === 'INCOME'
                ? <ArrowDownLeft className="h-4 w-4 text-emerald-500 shrink-0" />
                : <ArrowUpRight className="h-4 w-4 text-red-500 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {getCategoryEmoji(entry.category)} {getCategoryLabel(entry.category)}
                  {entry.description ? ` – ${entry.description}` : ''}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">{entry.date}</p>
              </div>
              <p className={`text-sm font-bold shrink-0 ${entry.type === 'INCOME' ? 'text-emerald-600' : 'text-red-500'}`}>
                {entry.type === 'INCOME' ? '+' : '-'}{formatKES(entry.amount)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Item drill-down */}
      <div className="pt-2 border-t border-[var(--color-border)]">
        <p className="font-semibold text-sm mb-3">Commodity Breakdown</p>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
          <input type="text" placeholder="Search an item…" value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]" />
        </div>
        {searchQuery && (
          <div className="flex flex-col gap-2 mb-4 max-h-52 overflow-y-auto">
            {filteredItems.map((item) => (
              <button key={item.id} onClick={() => handleSelectItem(item)}
                className="flex items-center justify-between rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-left hover:border-[var(--color-accent)] transition-colors">
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{item.quantity} {item.unit} · {item.sellingPrice ? `KES ${item.sellingPrice}` : 'No price'}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)]" />
              </button>
            ))}
            {filteredItems.length === 0 && <p className="text-sm text-center text-[var(--color-text-secondary)] py-4">No items found.</p>}
          </div>
        )}
        {loadingItem && <div className="h-40 animate-pulse rounded-2xl bg-muted" />}
        {selectedItem && !loadingItem && (
          <div className="rounded-2xl border border-[var(--color-border)] p-4 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-base">{selectedItem.name}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{selectedItem.currentStock} {selectedItem.unit} in stock</p>
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
                <p className="mt-0.5">Profit per unit: <strong className={selectedItem.sellingPrice > selectedItem.costPrice ? 'text-green-600' : 'text-red-600'}>KES {(selectedItem.sellingPrice - selectedItem.costPrice).toFixed(2)}</strong></p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import AddCreditSheet from '@/components/finance/AddCreditSheet';

// ─── Credit Tab ───────────────────────────────────────────────────────────────

function CreditTab({ orgId, getToken }: { orgId: string; getToken: () => Promise<string | null> }) {
  const { getCredits, recordPayment, createCredit, updateCredit } = require('@/services/credit.service');
  
  const fetchCredits = async () => {
    const token = await getToken();
    if (!token) throw new Error('No token');
    return getCredits(token, orgId);
  };

  const { data: credits = [], isLoading: loading, mutate: load } = useSWR(
    orgId ? ['credits', orgId] : null,
    fetchCredits
  );

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'PARTIAL' | 'PAID'>('ALL');
  const [selectedCredit, setSelectedCredit] = useState<any | null>(null);
  const [editingCredit, setEditingCredit] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paying, setPaying] = useState(false);
  const [showAddCredit, setShowAddCredit] = useState(false);

  const filtered = statusFilter === 'ALL' ? credits : credits.filter((c: any) => c.status === statusFilter);

  const totalOwed = credits.filter((c: any) => c.status !== 'PAID').reduce((sum: number, c: any) => sum + (Number(c.amountTotal) - Number(c.amountPaid)), 0);

  const handlePay = async () => {
    if (!selectedCredit || !paymentAmount) return;
    setPaying(true);
    try {
      const token = await getToken();
      if (!token) return;
      await recordPayment(selectedCredit.id, Number(paymentAmount), paymentNotes || undefined, token, orgId);
      setPaymentAmount('');
      setPaymentNotes('');
      setSelectedCredit(null);
      load();
    } catch (e) {
      console.error(e);
    } finally {
      setPaying(false);
    }
  };

  const handleAddCredit = async (payload: any) => {
    const token = await getToken();
    if (!token) throw new Error('No token');
    await createCredit(payload, token, orgId);
    load();
  };

  const handleUpdateCredit = async (payload: any) => {
    if (!editingCredit) return;
    const token = await getToken();
    if (!token) throw new Error('No token');
    await updateCredit(editingCredit.id, payload, token, orgId);
    load();
  };

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="flex items-stretch gap-3">
        <div className="flex-1 rounded-2xl border border-blue-400/30 bg-blue-50/60 p-4 text-center">
          <p className="text-xs text-blue-600 font-semibold mb-1">Total Outstanding Credit</p>
          <p className="text-2xl font-black text-blue-600">{formatKES(totalOwed)}</p>
        </div>
        <button
          onClick={() => setShowAddCredit(true)}
          className="flex items-center justify-center rounded-2xl bg-[var(--color-accent)] px-4 text-white shadow-md hover:opacity-90 transition-opacity"
          title="Log Manual Credit"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <div className="flex gap-2">
        {(['ALL', 'UNPAID', 'PARTIAL', 'PAID'] as const).map((f) => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${statusFilter === f ? 'bg-[var(--color-accent)] text-white' : 'border border-[var(--color-border)] text-[var(--color-text-secondary)]'}`}>
            {f === 'ALL' ? 'All' : f === 'UNPAID' ? 'Unpaid' : f === 'PARTIAL' ? 'Partial' : 'Paid'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <span className="text-4xl">💳</span>
          <p className="font-semibold">No credit records</p>
          <p className="text-sm text-[var(--color-text-secondary)]">Goods taken on credit will appear here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((credit: any) => (
            <div key={credit.id} className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] px-4 py-3 bg-[var(--color-bg-surface)]">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{credit.clientName}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Total: {formatKES(Number(credit.amountTotal))} · Paid: {formatKES(Number(credit.amountPaid))}
                  {credit.dueDate && ` · Due: ${new Date(credit.dueDate).toLocaleDateString()}`}
                </p>
                {credit.transaction?.item?.name && (
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Item: {credit.transaction.item.name}</p>
                )}
                {credit.notes && !credit.transaction?.item?.name && (
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Note: {credit.notes}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="flex items-center justify-end gap-2 mb-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    credit.status === 'PAID' ? 'bg-emerald-100 text-emerald-600' :
                    credit.status === 'PARTIAL' ? 'bg-amber-100 text-amber-600' :
                    'bg-red-100 text-red-600'
                  }`}>
                    {credit.status}
                  </span>
                  <button onClick={() => setEditingCredit(credit)} className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors p-1">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {credit.status !== 'PAID' && (
                  <button onClick={() => setSelectedCredit(credit)} className="block w-full mt-1 text-xs font-semibold text-[var(--color-accent)] hover:underline">
                    Add Payment
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedCredit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[var(--color-bg-base)] p-5 shadow-xl">
            <h2 className="text-lg font-bold mb-1">Record Payment</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              For {selectedCredit.clientName}. Owed: {formatKES(Number(selectedCredit.amountTotal) - Number(selectedCredit.amountPaid))}
            </p>
            
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold mb-1 block">Amount Paid</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Paid via M-PESA"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => setSelectedCredit(null)}
                className="flex-1 rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handlePay}
                disabled={paying || !paymentAmount}
                className="flex-1 rounded-xl bg-[var(--color-accent)] py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {paying ? 'Saving...' : 'Save Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddCredit && <AddCreditSheet onClose={() => setShowAddCredit(false)} onSave={handleAddCredit} />}
      {editingCredit && (
        <AddCreditSheet
          onClose={() => setEditingCredit(null)}
          onUpdate={handleUpdateCredit}
          initialValues={editingCredit}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const [activeTab, setActiveTab] = useState<'overview' | 'expenses' | 'ledger' | 'credit'>('overview');

  const orgId = membership?.organization.id;

  if (!orgId) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Finance</h1>
        {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* Header */}
      <h1 className="text-2xl font-bold">Finance</h1>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-2xl bg-[var(--color-bg-base)] border border-[var(--color-border)]">
        {[
          { key: 'overview', label: '📊 Overview' },
          { key: 'expenses', label: '💸 Expenses' },
          { key: 'ledger', label: '📒 Ledger' },
          { key: 'credit', label: '💳 Credit' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 rounded-xl py-2 text-[10px] font-semibold transition-all ${
              activeTab === tab.key
                ? 'bg-[var(--color-bg-surface)] shadow text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-secondary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab orgId={orgId} getToken={getToken} />}
      {activeTab === 'expenses' && <ExpensesTab orgId={orgId} getToken={getToken} />}
      {activeTab === 'ledger' && <LedgerTab orgId={orgId} getToken={getToken} />}
      {activeTab === 'credit' && <CreditTab orgId={orgId} getToken={getToken} />}
    </div>
  );
}
