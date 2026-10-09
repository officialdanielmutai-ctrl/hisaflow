import { Check } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { TIER_CONTENT } from '@/lib/plans';
import type { HisaflowPlanTier, PaywallPlan } from '@/services/paywall.service';

export interface TierCardProps {
  plan: PaywallPlan;
  recommended?: boolean;
  selected?: boolean;
  /** Renders the tier but prevents selection (for example, an unpriced tier). */
  comingSoon?: boolean;
  badgeLabel?: string;
  ctaLabel: string;
  onSelect?: () => void;
}

export default function TierCard({
  plan,
  recommended = false,
  selected = false,
  comingSoon = false,
  badgeLabel,
  ctaLabel,
  onSelect,
}: TierCardProps) {
  const meta = TIER_CONTENT[plan.tier];
  const price = Number(plan.priceKes);
  const hasPrice = Number.isFinite(price) && price > 0;
  const interactive = Boolean(onSelect) && !comingSoon;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!interactive}
      aria-pressed={selected}
      className={cn(
        'relative flex w-full flex-col rounded-2xl border bg-[var(--color-bg-surface)] p-5 text-left transition-all',
        recommended
          ? 'border-[var(--color-accent)] shadow-[var(--shadow-raised)]'
          : 'border-[var(--color-border)]',
        selected && 'ring-2 ring-[var(--color-accent)]/30',
        comingSoon
          ? 'cursor-not-allowed opacity-70'
          : interactive
            ? 'hover:border-[var(--color-accent)]/60'
            : 'cursor-default',
      )}
    >
      {recommended && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-accent)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
          Most popular
        </span>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-bold text-[var(--color-text-primary)]">
          {plan.name}
        </span>
        {badgeLabel && (
          <span className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-accent)]">
            {badgeLabel}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
        {meta.audience}
      </p>

      <div className="mt-4">
        {hasPrice ? (
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-[var(--color-text-primary)]">
              {formatCurrency(price, 'KES')}
            </span>
            <span className="text-xs text-[var(--color-text-secondary)]">
              / month
            </span>
          </div>
        ) : (
          <span className="text-2xl font-bold text-[var(--color-text-secondary)]">
            Custom
          </span>
        )}
      </div>

      {/* The differentiator is the visually dominant line, per Section 2.2. */}
      <div className="mt-4 rounded-xl bg-[var(--color-bg-secondary)] px-3 py-2 text-sm font-semibold text-[var(--color-accent)]">
        {meta.differentiator}
      </div>

      <ul className="mt-4 flex-1 space-y-2">
        {meta.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" />
            <span className="text-[var(--color-text-secondary)]">{feature}</span>
          </li>
        ))}
      </ul>

      <span
        className={cn(
          'mt-5 flex h-10 items-center justify-center rounded-xl text-sm font-semibold transition-colors',
          selected
            ? 'bg-[var(--color-accent)] text-white'
            : 'border border-[var(--color-border)] text-[var(--color-text-primary)]',
          comingSoon && 'border-dashed',
        )}
      >
        {ctaLabel}
      </span>
    </button>
  );
}
