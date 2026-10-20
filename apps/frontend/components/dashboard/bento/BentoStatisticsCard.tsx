'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DayBarData {
  day: string;
  tag: string;
  pct: number; // 0 to 100
  isHighlight?: boolean;
}

const SATISFACTION_BARS: DayBarData[] = [
  { day: 'Mon', tag: '9.9%', pct: 40 },
  { day: 'Tue', tag: '11%', pct: 55 },
  { day: 'Wed', tag: '14%', pct: 70 },
  { day: 'Thu', tag: '18%', pct: 88, isHighlight: true },
  { day: 'Fri', tag: '10%', pct: 50 },
  { day: 'Sat', tag: '+78%', pct: 96, isHighlight: true },
  { day: 'Sun', tag: '50%', pct: 60 },
];

const INSIGHT_BARS: DayBarData[] = [
  { day: 'Mon', tag: '12k', pct: 45 },
  { day: 'Tue', tag: '16k', pct: 60 },
  { day: 'Wed', tag: '24k', pct: 75 },
  { day: 'Thu', tag: '38k', pct: 92, isHighlight: true },
  { day: 'Fri', tag: '31k', pct: 80 },
  { day: 'Sat', tag: '+92k', pct: 98, isHighlight: true },
  { day: 'Sun', tag: '19k', pct: 52 },
];

interface BentoStatisticsCardProps {
  className?: string;
  headlineValue?: string;
  headlineSubtitle?: string;
}

export default function BentoStatisticsCard({
  className,
  headlineValue = '+76%',
  headlineSubtitle = 'Customer satisfaction increases every week',
}: BentoStatisticsCardProps) {
  const [activeTab, setActiveTab] = useState<'satisfaction' | 'insight'>('satisfaction');
  const [period, setPeriod] = useState<'Weekly' | 'Monthly'>('Weekly');

  const bars = activeTab === 'satisfaction' ? SATISFACTION_BARS : INSIGHT_BARS;
  const displayHeadline = activeTab === 'satisfaction' ? headlineValue : '+84%';
  const displaySubtitle =
    activeTab === 'satisfaction'
      ? headlineSubtitle
      : 'Visitor insight volume has scaled across all channels';

  return (
    <div
      className={cn(
        'relative rounded-3xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] p-6 shadow-sm flex flex-col justify-between transition-all hover:border-[var(--color-accent)]',
        className,
      )}
    >
      {/* ── Top Header Controls ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h3 className="text-base font-bold text-[var(--color-text-primary)]">
          Statistics
        </h3>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Pill Tabs: Customer Satisfaction / Visitor Insight */}
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => setActiveTab('satisfaction')}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold transition-all',
                activeTab === 'satisfaction'
                  ? 'bg-[#0C1831] dark:bg-slate-800 text-white shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
              )}
            >
              Customer Satisfaction
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('insight')}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold transition-all',
                activeTab === 'insight'
                  ? 'bg-[#0C1831] dark:bg-slate-800 text-white shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
              )}
            >
              Visitor Insight
            </button>
          </div>

          {/* Timeframe Dropdown Pill */}
          <button
            type="button"
            onClick={() => setPeriod(period === 'Weekly' ? 'Monthly' : 'Weekly')}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
          >
            <span>{period}</span>
            <ChevronDown className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
          </button>
        </div>
      </div>

      {/* ── Main Section: Left Callout + 7 Capsule Bars ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
        {/* Left Stat Callout */}
        <div className="md:col-span-4 flex flex-col justify-end pb-2">
          <p className="text-4xl sm:text-5xl font-black text-[var(--color-text-primary)] tracking-tight">
            {displayHeadline}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mt-2 max-w-[180px]">
            {displaySubtitle}
          </p>
        </div>

        {/* Right 7 Vertical Capsule Bars */}
        <div className="md:col-span-8 flex items-end justify-between gap-2 pt-8">
          {bars.map((bar) => (
            <div key={bar.day} className="flex flex-col items-center gap-2 group flex-1">
              {/* Floating Pill Tag Above Pillar */}
              <div
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-bold transition-all shadow-sm shrink-0 whitespace-nowrap',
                  bar.isHighlight
                    ? 'bg-emerald-500 text-white dark:bg-emerald-400 dark:text-slate-950 font-black scale-105'
                    : 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/25',
                )}
              >
                {bar.tag}
              </div>

              {/* Vertical Capsule Pillar Track */}
              <div className="w-8 sm:w-10 h-36 sm:h-40 rounded-full bg-[var(--color-bg-elevated)] p-1 flex flex-col justify-end overflow-hidden transition-all group-hover:bg-[var(--color-border)]/60">
                <div
                  className={cn(
                    'w-full rounded-full transition-all duration-700 ease-out',
                    bar.isHighlight
                      ? 'bg-gradient-to-t from-cyan-400 via-teal-400 to-emerald-400 shadow-sm'
                      : 'bg-gradient-to-t from-cyan-300/80 via-teal-300/80 to-emerald-300/80 dark:from-cyan-500/50 dark:to-emerald-500/50',
                  )}
                  style={{ height: `${bar.pct}%` }}
                />
              </div>

              {/* Day Axis Label */}
              <span className="text-xs font-semibold text-[var(--color-text-secondary)] mt-1">
                {bar.day}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
