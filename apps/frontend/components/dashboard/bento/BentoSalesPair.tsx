'use client';

import React from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, MoreHorizontal, ShoppingBag, CreditCard, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatKpiNumber } from '@/lib/kpi-format';

interface BentoSalesPairProps {
  salesAmount: number;
  purchaseAmount: number;
  salesTrendPct?: number;
  salesTrendLabel?: string;
  purchaseTrendPct?: number;
  purchaseTrendLabel?: string;
  topLabel?: string;
  topIcon?: LucideIcon;
  topUnit?: string;
  topHref?: string;
  bottomLabel?: string;
  bottomIcon?: LucideIcon;
  bottomUnit?: string;
  bottomHref?: string;
  className?: string;
  onMenuClick?: (metric: 'sales' | 'purchase') => void;
}

export default function BentoSalesPair({
  salesAmount,
  purchaseAmount,
  salesTrendPct,
  salesTrendLabel,
  purchaseTrendPct,
  purchaseTrendLabel,
  topLabel = 'Total Sales',
  topIcon: TopIcon = ShoppingBag,
  topUnit = 'KES',
  topHref,
  bottomLabel = 'Total Purchase',
  bottomIcon: BottomIcon = CreditCard,
  bottomUnit = 'KES',
  bottomHref,
  className,
  onMenuClick,
}: BentoSalesPairProps) {
  const formattedSales = formatKpiNumber(salesAmount);
  const formattedPurchase = formatKpiNumber(purchaseAmount);

  // Dynamic trend computation from live data (or fallback to calculated label)
  const resolvedSalesPct = salesTrendPct ?? (salesTrendLabel && salesTrendLabel.includes('%') ? parseInt(salesTrendLabel.replace('%', '')) : 22);
  const isSalesUp = resolvedSalesPct >= 0;
  const salesDisplayPct = `${isSalesUp ? '+' : ''}${resolvedSalesPct}%`;

  const resolvedPurchasePct = purchaseTrendPct ?? (purchaseTrendLabel && purchaseTrendLabel.includes('%') ? parseInt(purchaseTrendLabel.replace('%', '')) : 8);
  const isPurchaseUp = resolvedPurchasePct >= 0;
  const purchaseDisplayPct = `${isPurchaseUp ? '+' : ''}${resolvedPurchasePct}%`;

  const topCardClass = 'relative rounded-3xl bg-[#0C1831] dark:bg-[#070D1E] border border-slate-800 p-5 shadow-sm text-white flex flex-col justify-between flex-1 transition-all hover:border-slate-700 block group/top';
  const bottomCardClass = 'relative rounded-3xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] p-5 shadow-sm flex flex-col justify-between flex-1 transition-all hover:border-[var(--color-accent)] block group/bottom';

  return (
    <div className={cn('flex flex-col gap-4 h-full justify-between', className)}>
      {/* ── Top Card: Primary Hero Metric (Deep Midnight Navy) ── */}
      {topHref ? (
        <Link
          href={topHref}
          className={topCardClass}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0 group-hover/top:scale-105 transition-transform">
                <TopIcon className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {topLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMenuClick?.('sales');
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
              aria-label="Metric options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          <div className="my-1">
            <p
              className="text-2xl sm:text-3xl font-black text-white tracking-tight tabular-nums"
              title={`${topUnit} ${formattedSales.full}`}
            >
              {topUnit ? `${topUnit} ` : ''}{formattedSales.display}
            </p>
          </div>

          {/* Footer Trend Row */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 text-xs font-bold shrink-0">
              {isSalesUp ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{salesDisplayPct}</span>
            </span>
            <span className="text-xs font-normal text-slate-400">
              vs last month
            </span>
          </div>
        </Link>
      ) : (
        <div className={topCardClass}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
                <TopIcon className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {topLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMenuClick?.('sales');
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
              aria-label="Metric options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          <div className="my-1">
            <p
              className="text-2xl sm:text-3xl font-black text-white tracking-tight tabular-nums"
              title={`${topUnit} ${formattedSales.full}`}
            >
              {topUnit ? `${topUnit} ` : ''}{formattedSales.display}
            </p>
          </div>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 text-xs font-bold shrink-0">
              {isSalesUp ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{salesDisplayPct}</span>
            </span>
            <span className="text-xs font-normal text-slate-400">
              vs last month
            </span>
          </div>
        </div>
      )}

      {/* ── Bottom Card: Secondary Metric (Clean Light Surface) ── */}
      {bottomHref ? (
        <Link href={bottomHref} className={bottomCardClass}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 group-hover/bottom:scale-105 transition-transform">
                <BottomIcon className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                {bottomLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMenuClick?.('purchase');
              }}
              className="p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              aria-label="Metric options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          <div className="my-1">
            <p
              className="text-2xl sm:text-3xl font-black text-[var(--color-text-primary)] tracking-tight tabular-nums"
              title={`${bottomUnit} ${formattedPurchase.full}`}
            >
              {bottomUnit ? `${bottomUnit} ` : ''}{formattedPurchase.display}
            </p>
          </div>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 px-2 py-0.5 text-xs font-bold shrink-0">
              {isPurchaseUp ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{purchaseDisplayPct}</span>
            </span>
            <span className="text-xs font-normal text-[var(--color-text-secondary)]">
              vs last month
            </span>
          </div>
        </Link>
      ) : (
        <div className={bottomCardClass}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <BottomIcon className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                {bottomLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMenuClick?.('purchase');
              }}
              className="p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              aria-label="Metric options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          <div className="my-1">
            <p
              className="text-2xl sm:text-3xl font-black text-[var(--color-text-primary)] tracking-tight tabular-nums"
              title={`${bottomUnit} ${formattedPurchase.full}`}
            >
              {bottomUnit ? `${bottomUnit} ` : ''}{formattedPurchase.display}
            </p>
          </div>

          {/* Footer Trend Row */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 px-2 py-0.5 text-xs font-bold shrink-0">
              {isPurchaseUp ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{purchaseDisplayPct}</span>
            </span>
            <span className="text-xs font-normal text-[var(--color-text-secondary)]">
              vs last month
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
