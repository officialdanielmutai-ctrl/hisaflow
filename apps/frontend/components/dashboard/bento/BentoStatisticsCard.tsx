'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DayBarData {
  day: string;
  tag: string;
  pct: number; // 0 to 100
  isHighlight?: boolean;
}

const DEFAULT_TAB1_BARS: DayBarData[] = [
  { day: 'Mon', tag: '35%', pct: 35 },
  { day: 'Tue', tag: '50%', pct: 50 },
  { day: 'Wed', tag: '65%', pct: 65 },
  { day: 'Thu', tag: '82%', pct: 82, isHighlight: true },
  { day: 'Fri', tag: '70%', pct: 70 },
  { day: 'Sat', tag: '+95%', pct: 95, isHighlight: true },
  { day: 'Sun', tag: '60%', pct: 60 },
];

const DEFAULT_TAB2_BARS: DayBarData[] = [
  { day: 'Mon', tag: '40%', pct: 40 },
  { day: 'Tue', tag: '55%', pct: 55 },
  { day: 'Wed', tag: '70%', pct: 70 },
  { day: 'Thu', tag: '85%', pct: 85, isHighlight: true },
  { day: 'Fri', tag: '75%', pct: 75 },
  { day: 'Sat', tag: '+90%', pct: 90, isHighlight: true },
  { day: 'Sun', tag: '50%', pct: 50 },
];

export interface DropdownOption {
  id: string;
  label: string;
  badge?: string;
}

interface BentoStatisticsCardProps {
  title?: string;
  tab1Label?: string;
  tab2Label?: string;
  className?: string;
  headlineValue?: string;
  headlineSubtitle?: string;
  tab1Bars?: DayBarData[];
  tab2Bars?: DayBarData[];
  dropdownOptions?: DropdownOption[];
  selectedOptionId?: string;
  onSelectOption?: (id: string) => void;
}

export default function BentoStatisticsCard({
  title = 'Statistics',
  tab1Label = 'Primary Metric',
  tab2Label = 'Operational Flow',
  className,
  headlineValue = '+76%',
  headlineSubtitle = 'Throughput metrics tracked across all active streams',
  tab1Bars,
  tab2Bars,
  dropdownOptions,
  selectedOptionId,
  onSelectOption,
}: BentoStatisticsCardProps) {
  const [activeTab, setActiveTab] = useState<'tab1' | 'tab2'>('tab1');
  const [period, setPeriod] = useState<'Weekly' | 'Monthly'>('Weekly');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const rawBars = activeTab === 'tab1'
    ? (tab1Bars ?? DEFAULT_TAB1_BARS)
    : (tab2Bars ?? DEFAULT_TAB2_BARS);

  // Auto-highlight peak bar if none explicitly marked
  const maxPct = Math.max(...rawBars.map(b => b.pct), 1);
  const bars = rawBars.map(b => ({
    ...b,
    isHighlight: b.isHighlight ?? (b.pct === maxPct && maxPct > 0),
  }));

  const selectedOption = dropdownOptions?.find(o => o.id === selectedOptionId) ?? dropdownOptions?.[0];
  const dropdownLabel = selectedOption ? selectedOption.label : period;

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
          {title}
        </h3>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Pill Tabs */}
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => setActiveTab('tab1')}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold transition-all',
                activeTab === 'tab1'
                  ? 'bg-[#0C1831] dark:bg-slate-800 text-white shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
              )}
            >
              {tab1Label}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tab2')}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold transition-all',
                activeTab === 'tab2'
                  ? 'bg-[#0C1831] dark:bg-slate-800 text-white shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
              )}
            >
              {tab2Label}
            </button>
          </div>

          {/* Timeframe / Entity Dropdown Pill */}
          <div className="relative inline-block text-left" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => {
                if (dropdownOptions && dropdownOptions.length > 0) {
                  setIsDropdownOpen(!isDropdownOpen);
                } else {
                  setPeriod(period === 'Weekly' ? 'Monthly' : 'Weekly');
                }
              }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors max-w-[170px]',
                isDropdownOpen && 'border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/30',
              )}
            >
              <span className="truncate">{dropdownLabel}</span>
              <ChevronDown className={cn('h-3.5 w-3.5 text-[var(--color-text-muted)] shrink-0 transition-transform', isDropdownOpen && 'rotate-180')} />
            </button>

            {/* Dropdown Popover */}
            {isDropdownOpen && dropdownOptions && (
              <div className="absolute right-0 mt-2 w-64 max-h-60 overflow-y-auto no-scrollbar rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] shadow-xl z-50 p-1 flex flex-col gap-0.5 animate-in fade-in-0 zoom-in-95 duration-100">
                {dropdownOptions.map((opt) => {
                  const isSelected = opt.id === (selectedOptionId ?? dropdownOptions[0]?.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        onSelectOption?.(opt.id);
                        setIsDropdownOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors text-left',
                        isSelected
                          ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-bold'
                          : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]',
                      )}
                    >
                      <span className="truncate">{opt.label}</span>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {opt.badge && (
                          <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.2 text-[9px] font-bold">
                            {opt.badge}
                          </span>
                        )}
                        {isSelected && <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Section: Left Callout + 7 Capsule Bars ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
        {/* Left Stat Callout */}
        <div className="md:col-span-4 flex flex-col justify-end pb-2">
          <p className="text-4xl sm:text-5xl font-black text-[var(--color-text-primary)] tracking-tight">
            {headlineValue}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mt-2 max-w-[200px]">
            {headlineSubtitle}
          </p>
        </div>

        {/* Right 7 Vertical Capsule Bars */}
        <div className="md:col-span-8 flex items-end justify-between gap-2 pt-8">
          {bars.map((bar) => (
            <div
              key={bar.day}
              className="flex flex-col items-center gap-2 group flex-1 cursor-pointer transition-transform duration-300 hover:-translate-y-1"
            >
              {/* Floating Pill Tag Above Pillar */}
              <div
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-bold transition-all shadow-sm shrink-0 whitespace-nowrap group-hover:scale-110 group-hover:shadow-md',
                  bar.isHighlight
                    ? 'bg-emerald-500 text-white dark:bg-emerald-400 dark:text-slate-950 font-black scale-105 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                    : 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/25',
                )}
              >
                {bar.tag}
              </div>

              {/* Vertical Capsule Pillar Track */}
              <div className="relative w-8 sm:w-10 h-36 sm:h-40 rounded-full bg-[var(--color-bg-elevated)] p-1 flex flex-col justify-end overflow-hidden transition-all group-hover:bg-[var(--color-border)]/60 group-hover:shadow-inner">
                <div
                  className={cn(
                    'w-full rounded-full transition-all duration-700 ease-out group-hover:brightness-110',
                    bar.isHighlight
                      ? 'bg-gradient-to-t from-cyan-400 via-teal-400 to-emerald-400 shadow-sm'
                      : 'bg-gradient-to-t from-cyan-300/80 via-teal-300/80 to-emerald-300/80 dark:from-cyan-500/50 dark:to-emerald-500/50',
                  )}
                  style={{ height: `${Math.max(bar.pct, 8)}%` }}
                />
              </div>

              {/* Day Axis Label */}
              <span className="text-xs font-semibold text-[var(--color-text-secondary)] mt-1 transition-colors group-hover:text-[var(--color-text-primary)]">
                {bar.day}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
