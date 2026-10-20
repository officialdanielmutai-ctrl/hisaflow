import Link from 'next/link';
import React from 'react';
import { MoreHorizontal, TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Shared KPI/stat card (HisaFlow KPI Inspo Overhaul).
 *
 * Sizing, padding, alignment, tabular figures, truncation, slot layout,
 * dark theme compliance, and adversarial states (loading / empty / error).
 *
 * Supported Slots & Capabilities:
 * - Surface Variants: neutral, blue, emerald, amber, rose, and **hero** (deep dark midnight navy contrast)
 * - Temporal Delta Badge: explicit time-comparison indicator (e.g. "+ 22% vs last month")
 * - Micro-Visualizations: Area Spline Sparklines, Semi-Radial Arc Gauges, Segmented Velocity Bars
 * - In-card Quick Actions: Contextual trigger buttons (e.g. "Record Sale", "Check In")
 */
export type StatTone = 'blue' | 'emerald' | 'amber' | 'rose' | 'neutral' | 'hero';
export type StatVariant = 'default' | 'compact';
export type StatState = 'default' | 'loading' | 'empty' | 'error';
export type StatEmphasis = 'default' | 'success' | 'warning' | 'critical';

export type StatTrailing =
  | { kind: 'arrow' }
  | { kind: 'menu'; onClick?: (e: React.MouseEvent) => void }
  | { kind: 'badge'; text: string; tone: StatTone };

export interface StatDelta {
  value: string; // e.g. "+22%" or "-8%"
  period?: string; // e.g. "vs last month"
  direction?: 'up' | 'down' | 'flat';
  tone?: 'success' | 'warning' | 'critical' | 'neutral';
}

export interface StatAction {
  label: string;
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export interface StatCardContent {
  value: string;
  sublabel?: string;
  valueSuffix?: string;
  fullValue?: string;
  valueTone?: StatEmphasis;
  footnote?: string;
  footnoteTone?: StatEmphasis;
  trailing?: StatTrailing;
  delta?: StatDelta;
  sparklineData?: number[];
  gauge?: { value: number; max?: number; label?: string };
  progress?: { value: number; max?: number; label?: string; targetLabel?: string };
  action?: StatAction;
}

/** One card in a vertical's arrangement. */
export interface StatCardConfig<TData = unknown> {
  id: string;
  label: string;
  icon: LucideIcon;
  iconTone?: StatTone;
  cardTone?: StatTone;
  variant?: StatVariant;
  href?: string;
  /** Grid span at `sm` and up; the row grid is 2 columns on mobile, up to 4 on desktop. */
  span?: 1 | 2;
  build: (data: TData) => StatCardContent;
}

export interface StatCardProps extends StatCardContent {
  label: string;
  sublabel?: string;
  icon: LucideIcon;
  iconTone?: StatTone;
  cardTone?: StatTone;
  variant?: StatVariant;
  href?: string;
  state?: StatState;
  stateMessage?: string;
  className?: string;
}

const ICON_TONES: Record<StatTone, string> = {
  hero: 'bg-white/10 text-white border border-white/20',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  neutral:
    'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]',
};

const CARD_TONES: Record<StatTone, string> = {
  hero: 'border-slate-800 bg-[#0C1831] text-white shadow-md hover:border-slate-700 dark:bg-[#070D1E] dark:border-slate-800',
  blue: 'border-blue-200/80 bg-gradient-to-br from-blue-50/40 via-[var(--color-bg-surface)] to-[var(--color-bg-surface)] hover:border-blue-400 dark:border-blue-900/50',
  emerald:
    'border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 via-[var(--color-bg-surface)] to-[var(--color-bg-surface)] hover:border-emerald-400 dark:border-emerald-900/50',
  amber:
    'border-amber-200/80 bg-gradient-to-br from-amber-50/40 via-[var(--color-bg-surface)] to-[var(--color-bg-surface)] hover:border-amber-400 dark:border-amber-900/50',
  rose: 'border-rose-200/80 bg-gradient-to-br from-rose-50/40 via-[var(--color-bg-surface)] to-[var(--color-bg-surface)] hover:border-rose-400 dark:border-rose-900/50',
  neutral:
    'border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:border-[var(--color-accent)]',
};

const VALUE_TONES: Record<StatEmphasis, string> = {
  default: 'text-[var(--color-text-primary)]',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  critical: 'text-[var(--color-status-critical)]',
};

const FOOTNOTE_TONES: Record<StatEmphasis, string> = {
  default: 'text-[var(--color-text-secondary)]',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  critical: 'text-[var(--color-status-critical)]',
};

const BADGE_TONES: Record<StatTone, string> = {
  hero: 'bg-white/10 text-slate-200 border border-white/20',
  blue: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
  emerald: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  amber: 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  rose: 'bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
  neutral:
    'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border)]',
};

function TrailingSlot({
  trailing,
  tone,
}: {
  trailing?: StatTrailing;
  tone: StatTone;
}) {
  if (!trailing) return null;
  if (trailing.kind === 'menu') {
    return (
      <button
        type="button"
        onClick={trailing.onClick}
        aria-label="Options"
        className="p-1 rounded-lg text-slate-400 hover:text-slate-200 dark:hover:text-white transition-colors"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
    );
  }
  if (trailing.kind === 'badge') {
    return (
      <span
        className={cn(
          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
          BADGE_TONES[trailing.tone],
        )}
      >
        {trailing.text}
      </span>
    );
  }
  // kind === 'arrow' deliberately renders nothing to eliminate non-functional arrows
  return null;
}

function DeltaBadge({ delta, isHero }: { delta: StatDelta; isHero?: boolean }) {
  const isUp = delta.direction === 'up' || delta.value.startsWith('+');
  const isDown = delta.direction === 'down' || delta.value.startsWith('-');
  const tone = delta.tone ?? (isUp ? 'success' : isDown ? 'critical' : 'neutral');

  const toneClasses = isHero
    ? 'bg-teal-500/20 text-teal-300 border-teal-500/30'
    : tone === 'success'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50'
      : tone === 'critical'
        ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50'
        : tone === 'warning'
          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50'
          : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border)]';

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold border transition-colors shrink-0',
          toneClasses,
        )}
      >
        {isUp ? (
          <TrendingUp className="h-3 w-3" />
        ) : isDown ? (
          <TrendingDown className="h-3 w-3" />
        ) : (
          <Minus className="h-3 w-3" />
        )}
        <span>{delta.value}</span>
      </span>
      {delta.period && (
        <span
          className={cn(
            'text-xs font-normal',
            isHero ? 'text-slate-400' : 'text-[var(--color-text-secondary)]',
          )}
        >
          {delta.period}
        </span>
      )}
    </div>
  );
}

function StatSparkline({ data, isHero }: { data: number[]; isHero?: boolean }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 120;
  const height = 36;
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const pathD = `M ${points.join(' L ')}`;
  const fillD = `${pathD} L ${width},${height} L 0,${height} Z`;

  const strokeColor = isHero ? '#34d399' : '#10b981';
  const gradId = `spark-grad-${Math.abs(data.reduce((a, b) => a + b, 0))}`;

  return (
    <div className="w-full h-8 my-1">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.35} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <path d={fillD} fill={`url(#${gradId})`} />
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function StatGauge({ value, max = 100, label, isHero }: { value: number; max?: number; label?: string; isHero?: boolean }) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  const radius = 34;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;
  const strokeColor = isHero ? '#34d399' : '#10b981';

  return (
    <div className="relative flex flex-col items-center justify-center my-1">
      <svg viewBox="0 0 90 52" className="w-24 h-14">
        <path
          d="M 11,46 A 34,34 0 0,1 79,46"
          fill="none"
          stroke={isHero ? 'rgba(255,255,255,0.15)' : 'var(--color-border)'}
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M 11,46 A 34,34 0 0,1 79,46"
          fill="none"
          stroke={strokeColor}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute bottom-0 text-center">
        <span className={cn('text-xs font-black', isHero ? 'text-white' : 'text-[var(--color-text-primary)]')}>
          {Math.round(pct)}%
        </span>
        {label && <p className="text-[9px] text-[var(--color-text-muted)] truncate">{label}</p>}
      </div>
    </div>
  );
}

function StatProgressBar({ value, max = 100, label, targetLabel, isHero }: { value: number; max?: number; label?: string; targetLabel?: string; isHero?: boolean }) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  return (
    <div className="w-full my-1.5 flex flex-col gap-1">
      <div className={cn('h-2 w-full rounded-full overflow-hidden', isHero ? 'bg-white/10' : 'bg-[var(--color-bg-elevated)]')}>
        <div
          className={cn('h-full rounded-full transition-all duration-500', isHero ? 'bg-emerald-400' : 'bg-gradient-to-r from-[var(--color-accent)] to-emerald-400')}
          style={{ width: `${pct}%` }}
        />
      </div>
      {(label || targetLabel) && (
        <div className={cn('flex items-center justify-between text-[10px]', isHero ? 'text-emerald-200/70' : 'text-[var(--color-text-muted)]')}>
          {label && <span>{label}</span>}
          {targetLabel && <span>{targetLabel}</span>}
        </div>
      )}
    </div>
  );
}

function StatSkeleton({ compact }: { compact: boolean }) {
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-[var(--color-bg-elevated)]" />
          <div className="min-w-0">
            <span className="block w-24 truncate rounded bg-[var(--color-bg-elevated)] text-xs text-transparent">
              &nbsp;
            </span>
            <span className="block w-16 truncate rounded bg-[var(--color-bg-elevated)] text-[11px] text-transparent">
              &nbsp;
            </span>
          </div>
        </div>
      </div>
      <div className="my-1 min-w-0">
        <p
          className={cn(
            'w-28 truncate rounded bg-[var(--color-bg-elevated)] text-transparent',
            compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl',
          )}
        >
          &nbsp;
        </p>
      </div>
      <p className="min-h-[18px] w-28 truncate rounded bg-[var(--color-bg-elevated)] text-xs text-transparent">
        &nbsp;
      </p>
    </>
  );
}

export function StatCard({
  label,
  sublabel,
  value,
  valueSuffix,
  fullValue,
  valueTone = 'default',
  footnote,
  footnoteTone = 'default',
  trailing,
  delta,
  sparklineData,
  gauge,
  progress,
  action,
  icon: Icon,
  iconTone,
  cardTone = 'neutral',
  variant = 'default',
  href,
  state = 'default',
  stateMessage,
  className,
}: StatCardProps) {
  const compact = variant === 'compact';
  const resolvedIconTone = iconTone ?? cardTone;
  const isHero = cardTone === 'hero';

  if (state === 'loading') {
    return (
      <div
        data-testid="stat-card"
        data-stat-label={label}
        aria-hidden="true"
        className={cn(
          'flex h-full min-w-0 animate-pulse flex-col justify-between rounded-2xl border p-4 shadow-sm sm:p-5',
          CARD_TONES[cardTone],
          className,
        )}
      >
        <StatSkeleton compact={compact} />
      </div>
    );
  }

  const isError = state === 'error';
  const isEmpty = state === 'empty';
  const displayValue = isError || isEmpty ? '—' : value;
  const displayFootnote = isError
    ? (stateMessage ?? 'Could not load this metric.')
    : isEmpty
      ? (stateMessage ?? 'No data yet.')
      : footnote;
  const hasFootnote = Boolean(displayFootnote);

  const body = (
    <>
      {/* Top Header Slot */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
              ICON_TONES[resolvedIconTone],
            )}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <span
              className={cn(
                'block truncate text-xs font-bold uppercase tracking-wider',
                isHero ? 'text-slate-300' : 'text-[var(--color-text-primary)]',
              )}
            >
              {label}
            </span>
            {sublabel ? (
              <span
                className={cn(
                  'block truncate text-[11px]',
                  isHero ? 'text-slate-400' : 'text-[var(--color-text-secondary)]',
                )}
              >
                {sublabel}
              </span>
            ) : null}
          </div>
        </div>
        <TrailingSlot trailing={trailing} tone={cardTone} />
      </div>

      {/* Main Metric Value */}
      <div className="my-1 min-w-0">
        <p
          data-stat-value
          title={fullValue}
          className={cn(
            'truncate font-black tracking-tight tabular-nums',
            isHero ? 'text-white' : VALUE_TONES[valueTone],
            compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl',
          )}
        >
          {displayValue}
          {!isError && !isEmpty && valueSuffix ? (
            <span
              className={cn(
                'ml-1 text-base font-medium sm:text-lg',
                isHero ? 'text-slate-400' : 'text-[var(--color-text-secondary)]',
              )}
            >
              {valueSuffix}
            </span>
          ) : null}
        </p>
      </div>

      {/* Optional Micro-Visualizations */}
      {!isError && !isEmpty && gauge && (
        <StatGauge value={gauge.value} max={gauge.max} label={gauge.label} isHero={isHero} />
      )}
      {!isError && !isEmpty && sparklineData && sparklineData.length > 1 && (
        <StatSparkline data={sparklineData} isHero={isHero} />
      )}
      {!isError && !isEmpty && progress && (
        <StatProgressBar
          value={progress.value}
          max={progress.max}
          label={progress.label}
          targetLabel={progress.targetLabel}
          isHero={isHero}
        />
      )}

      {/* Footer / Delta / Action Row */}
      <div className="mt-2 flex items-center justify-between gap-2 min-h-[22px]">
        {delta && !isError && !isEmpty ? (
          <DeltaBadge delta={delta} isHero={isHero} />
        ) : hasFootnote ? (
          <p
            className={cn(
              'truncate text-xs',
              isHero
                ? 'text-slate-400'
                : isError
                  ? FOOTNOTE_TONES.critical
                  : FOOTNOTE_TONES[footnoteTone],
            )}
          >
            {displayFootnote}
          </p>
        ) : (
          <span />
        )}

        {action && (
          <Link
            href={action.href ?? '#'}
            onClick={action.onClick}
            className={cn(
              'shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full border transition-colors',
              isHero
                ? 'border-slate-700 text-slate-200 bg-white/5 hover:bg-white/15'
                : 'border-[var(--color-border)] text-[var(--color-accent)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-surface-hover)]',
            )}
          >
            {action.label}
          </Link>
        )}
      </div>
    </>
  );

  const classes = cn(
    'group flex h-full min-w-0 flex-col justify-between rounded-2xl border p-4 shadow-sm transition-all sm:p-5',
    CARD_TONES[cardTone],
    className,
  );

  if (href) {
    return (
      <Link
        href={href}
        data-testid="stat-card"
        data-stat-label={label}
        className={classes}
      >
        {body}
      </Link>
    );
  }

  return (
    <div data-testid="stat-card" data-stat-label={label} className={classes}>
      {body}
    </div>
  );
}
