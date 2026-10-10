import Link from 'next/link';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Shared KPI/stat card (overhaul Duty 1, Section 2.5).
 *
 * This is the single building block every vertical's dashboard uses: it owns
 * sizing, padding, alignment, tabular figures, truncation, the slot layout and
 * the loading/empty/error states, so a fix here reaches every vertical. The
 * *arrangement* (which cards, how many, in what order and how wide) lives in
 * each vertical's config, not here.
 *
 * Slots: icon, label, sublabel, value, unit (valueSuffix), trailing, footnote.
 * A vertical fills the slots it needs; empty slots are skipped without leaving
 * gaps, and the footnote row is always reserved so siblings stay aligned.
 */
export type StatTone = 'blue' | 'emerald' | 'amber' | 'rose' | 'neutral';
export type StatVariant = 'default' | 'compact';
export type StatState = 'default' | 'loading' | 'empty' | 'error';

export type StatTrailing =
  | { kind: 'arrow' }
  | { kind: 'badge'; text: string; tone: Exclude<StatTone, 'blue'> };

export interface StatCardContent {
  value: string;
  sublabel?: string;
  valueSuffix?: string;
  fullValue?: string;
  footnote?: string;
  trailing?: StatTrailing;
}

/** One card in a vertical's arrangement (Section 2.5). */
export interface StatCardConfig<TData = unknown> {
  id: string;
  label: string;
  icon: LucideIcon;
  iconTone?: StatTone;
  cardTone?: StatTone;
  variant?: StatVariant;
  href?: string;
  /** Grid span at `sm` and up; the row grid is 2 columns. */
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
  blue: 'bg-blue-100 text-blue-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  rose: 'bg-rose-100 text-rose-700',
  neutral:
    'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]',
};

const CARD_TONES: Record<StatTone, string> = {
  blue: 'border-blue-200/80 bg-gradient-to-br from-blue-50/40 via-[var(--color-bg-surface)] to-[var(--color-bg-surface)] hover:border-blue-400',
  emerald:
    'border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 via-[var(--color-bg-surface)] to-[var(--color-bg-surface)] hover:border-emerald-400',
  amber:
    'border-amber-200/80 bg-gradient-to-br from-amber-50/40 via-[var(--color-bg-surface)] to-[var(--color-bg-surface)] hover:border-amber-400',
  rose: 'border-rose-200/80 bg-gradient-to-br from-rose-50/40 via-[var(--color-bg-surface)] to-[var(--color-bg-surface)] hover:border-rose-400',
  neutral:
    'border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:border-[var(--color-accent)]',
};

const ARROW_TONES: Record<StatTone, string> = {
  blue: 'group-hover:text-blue-600',
  emerald: 'group-hover:text-emerald-600',
  amber: 'group-hover:text-amber-600',
  rose: 'group-hover:text-rose-600',
  neutral: 'group-hover:text-[var(--color-accent)]',
};

const BADGE_TONES: Record<Exclude<StatTone, 'blue'>, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  amber: 'bg-amber-100 text-amber-800 border border-amber-200',
  rose: 'bg-rose-100 text-rose-800 border border-rose-200',
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
  if (trailing.kind === 'arrow') {
    return (
      <ArrowUpRight
        aria-hidden="true"
        className={cn(
          'h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-colors',
          ARROW_TONES[tone],
        )}
      />
    );
  }
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

function StatSkeleton({ compact }: { compact: boolean }) {
  return (
    <div className="animate-pulse" aria-hidden="true">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[var(--color-bg-elevated)]" />
          <div className="flex flex-col gap-1.5">
            <div className="h-3 w-24 rounded bg-[var(--color-bg-elevated)]" />
            <div className="h-2.5 w-16 rounded bg-[var(--color-bg-elevated)]" />
          </div>
        </div>
      </div>
      <div
        className={cn(
          'my-1 rounded bg-[var(--color-bg-elevated)]',
          compact ? 'h-6 w-20' : 'h-8 w-28',
        )}
      />
      <div className="h-3 w-28 rounded bg-[var(--color-bg-elevated)]" />
    </div>
  );
}

export function StatCard({
  label,
  sublabel,
  value,
  valueSuffix,
  fullValue,
  footnote,
  trailing,
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

  if (state === 'loading') {
    return (
      <div
        data-testid="stat-card"
        data-stat-label={label}
        className={cn(
          'h-full rounded-2xl border p-4 shadow-sm sm:p-5',
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
      <div className="mb-3 flex items-center justify-between gap-3">
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
            <span className="block truncate text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
              {label}
            </span>
            {sublabel ? (
              <span className="block truncate text-[11px] text-[var(--color-text-secondary)]">
                {sublabel}
              </span>
            ) : null}
          </div>
        </div>
        <TrailingSlot trailing={trailing} tone={cardTone} />
      </div>

      <div className="my-1 min-w-0">
        <p
          data-stat-value
          title={fullValue}
          className={cn(
            'truncate font-black tracking-tight text-[var(--color-text-primary)] tabular-nums',
            compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl',
          )}
        >
          {displayValue}
          {!isError && !isEmpty && valueSuffix ? (
            <span className="ml-1 text-base font-medium text-[var(--color-text-secondary)] sm:text-lg">
              {valueSuffix}
            </span>
          ) : null}
        </p>
      </div>

      {/* Footnote row is always reserved so cards with and without one align. */}
      <p
        className={cn(
          'min-h-[18px] truncate text-xs',
          isError
            ? 'text-[var(--color-status-critical)]'
            : 'text-[var(--color-text-secondary)]',
        )}
      >
        {hasFootnote ? displayFootnote : ''}
      </p>
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
