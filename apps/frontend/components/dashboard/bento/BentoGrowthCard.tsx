'use client';

import React, { useState } from 'react';
import { MoreHorizontal, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export type GrowthTimeframe = '24h' | '12h' | 'week' | 'month';

interface GrowthData {
  count: string;
  delta: string;
  progressPct: number;
  footerTotal: string;
  footerAdd: string;
}

const TIMEFRAME_PRESETS: Record<GrowthTimeframe, GrowthData> = {
  '24h': {
    count: '205,890',
    delta: '+ 22%',
    progressPct: 68,
    footerTotal: 'Checking totally',
    footerAdd: '+210 today',
  },
  '12h': {
    count: '114,320',
    delta: '+ 14%',
    progressPct: 48,
    footerTotal: 'Checking totally',
    footerAdd: '+95 today',
  },
  week: {
    count: '864,250',
    delta: '+ 36%',
    progressPct: 82,
    footerTotal: 'Checking totally',
    footerAdd: '+1,420 this week',
  },
  month: {
    count: '2,490,100',
    delta: '+ 48%',
    progressPct: 94,
    footerTotal: 'Checking totally',
    footerAdd: '+4,890 this month',
  },
};

interface BentoGrowthCardProps {
  className?: string;
  onMenuClick?: () => void;
  customData?: Partial<Record<GrowthTimeframe, GrowthData>>;
}

export default function BentoGrowthCard({
  className,
  onMenuClick,
  customData,
}: BentoGrowthCardProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<GrowthTimeframe>('24h');

  const activeData = {
    ...TIMEFRAME_PRESETS[selectedTimeframe],
    ...(customData?.[selectedTimeframe] ?? {}),
  };

  return (
    <div
      className={cn(
        'relative rounded-3xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] p-6 shadow-sm flex flex-col justify-between transition-all hover:border-[var(--color-accent)]',
        className,
      )}
    >
      {/* ── Header Row ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-[var(--color-text-primary)]">
            User Growth
          </h3>
          <button
            type="button"
            onClick={onMenuClick}
            className="p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label="Growth options"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        {/* ── Embedded Timeframe Pill Switcher ── */}
        <div className="inline-flex items-center gap-1.5 p-1 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] mb-5">
          {(
            [
              { key: '24h', label: '24h' },
              { key: '12h', label: '12h' },
              { key: 'week', label: 'A Week' },
              { key: 'month', label: 'Month' },
            ] as const
          ).map((tab) => {
            const isActive = selectedTimeframe === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSelectedTimeframe(tab.key)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold transition-all',
                  isActive
                    ? 'bg-[#0C1831] dark:bg-slate-800 text-white shadow-sm'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Metric & Delta Row ── */}
      <div className="my-2">
        <div className="flex items-center gap-3">
          <span className="text-3xl sm:text-4xl font-black text-[var(--color-text-primary)] tracking-tight tabular-nums">
            {activeData.count}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/25 px-2.5 py-0.5 text-xs font-bold">
            <TrendingUp className="h-3 w-3" />
            <span>{activeData.delta}</span>
          </span>
        </div>

        {/* ── Liquid-like Animated Progress Bar ── */}
        <div className="mt-4 mb-2 group/liquid relative">
          {/* Floating Hover Indicator Tooltip */}
          <div
            className="absolute -top-6 transition-all duration-300 opacity-0 group-hover/liquid:opacity-100 pointer-events-none transform -translate-x-1/2"
            style={{ left: `${activeData.progressPct}%` }}
          >
            <span className="rounded-full bg-[#0C1831] text-white px-2 py-0.5 text-[10px] font-black shadow-md border border-slate-700">
              {activeData.progressPct}%
            </span>
          </div>

          <div className="h-4 w-full rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-0.5 overflow-hidden transition-all duration-300 group-hover/liquid:shadow-md">
            <div
              className="relative h-full rounded-full bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 animate-liquid-shimmer transition-all duration-700 ease-out shadow-sm"
              style={{ width: `${activeData.progressPct}%` }}
            >
              {/* Undulating liquid wave sheen */}
              <div className="absolute inset-0 bg-white/25 rounded-full animate-liquid-wave opacity-60" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Split Footer Stats ── */}
      <div className="mt-2 pt-2 border-t border-[var(--color-border)]/60 flex items-center justify-between text-xs">
        <span className="text-[var(--color-text-secondary)] font-medium">
          {activeData.footerTotal}
        </span>
        <span className="font-bold text-[var(--color-text-primary)]">
          {activeData.footerAdd}
        </span>
      </div>
    </div>
  );
}
