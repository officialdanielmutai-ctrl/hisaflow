import { Check } from 'lucide-react';
import type { MarketingPlan } from '@/lib/plans';
import { TIER_CONTENT } from '@/lib/plans';
import { ButtonLink } from './Button';
import { TagPill } from './TagPill';
import { cn } from '@/lib/utils';
import { signUpHref, whatsappHref } from '@/features/marketing/config/site';

interface PricingCardProps {
  plan: MarketingPlan;
  recommended?: boolean;
}

function formatKes(amount: number): string {
  return `KES ${new Intl.NumberFormat('en-KE', {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

export function PricingCard({ plan, recommended = false }: PricingCardProps) {
  const content = TIER_CONTENT[plan.tier];
  const isGrowth = plan.cta === 'whatsapp';
  const wa = whatsappHref('growth');

  return (
    <article
      className={cn(
        'flex h-full flex-col rounded-[var(--mk-r-card)] p-6 md:p-8',
        recommended
          ? 'bg-[var(--mk-ink)] text-white lg:-mt-4'
          : 'border border-[var(--mk-line)] bg-[var(--mk-surface)] text-[var(--mk-ink)]',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="mk-h3">{plan.name}</h3>
        {recommended ? <TagPill tone="accent">Most popular</TagPill> : null}
      </div>
      <p
        className={cn(
          'mk-small mt-1',
          recommended ? 'text-white/60' : 'text-[var(--mk-ink-3)]',
        )}
      >
        {content.audience}
      </p>

      <div className="mt-6">
        {plan.priceKes != null ? (
          <p className="mk-numeral text-[40px]">
            {formatKes(plan.priceKes)}
            <span
              className={cn(
                'mk-small ml-2 font-normal',
                recommended ? 'text-white/60' : 'text-[var(--mk-ink-3)]',
              )}
            >
              /month
            </span>
          </p>
        ) : (
          <p className="text-[28px] font-bold">Contact us</p>
        )}
        <p
          className={cn(
            'mk-small mt-2 font-medium',
            recommended ? 'text-white/80' : 'text-[var(--mk-ink-2)]',
          )}
        >
          {content.differentiator}
        </p>
      </div>

      <ul className="mt-6 flex flex-1 flex-col gap-3">
        {content.features.map((feature) => (
          <li key={feature} className="flex items-start gap-3">
            <Check
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--mk-accent)]"
              strokeWidth={2}
            />
            <span
              className={cn(
                'mk-small',
                recommended ? 'text-white/85' : 'text-[var(--mk-ink-2)]',
              )}
            >
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        {isGrowth ? (
          wa ? (
            <ButtonLink
              href={wa}
              external
              variant={recommended ? 'accent' : 'secondary'}
              className="w-full"
              withArrow
            >
              Contact us
            </ButtonLink>
          ) : (
            <ButtonLink
              href="#final-cta"
              variant="secondary"
              className="w-full"
              withArrow
            >
              Contact us
            </ButtonLink>
          )
        ) : (
          <ButtonLink
            href={signUpHref(plan.tier)}
            variant={recommended ? 'accent' : 'primary'}
            className="w-full"
            withArrow
          >
            Start free trial
          </ButtonLink>
        )}
      </div>
    </article>
  );
}
