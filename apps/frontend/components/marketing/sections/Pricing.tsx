import { MARKETING_PLANS } from '@/lib/plans';
import { PRICING } from '@/features/marketing/config/content';
import { Section } from '../Section';
import { PricingCard } from '../PricingCard';
import { Reveal } from '../Reveal';

export function Pricing() {
  return (
    <Section
      id="pricing"
      className="!max-w-none !px-0"
      innerClassName="!rounded-none p-6 md:p-10 lg:p-16"
      contentClassName="mx-auto w-full max-w-[1360px]"
    >
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
        <h2 className="mk-h2 text-balance">{PRICING.headline}</h2>
        <p className="mk-body-lg mt-4 text-[var(--mk-ink-2)]">{PRICING.intro}</p>
      </div>

      <div className="mt-10 grid gap-4 lg:mt-14 lg:grid-cols-3 lg:items-stretch lg:gap-6">
        {MARKETING_PLANS.map((plan) => (
          <div key={plan.tier} className="h-full">
            <PricingCard
              plan={plan}
              recommended={plan.tier === PRICING.recommendedTier}
            />
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col items-center gap-2 text-center">
        <p className="mk-small font-medium text-[var(--mk-ink-2)]">
          {PRICING.microcopy}
        </p>
        <p className="mk-small max-w-[52ch] text-[var(--mk-ink-3)]">
          {PRICING.paymentNote}
        </p>
      </div>
      </Reveal>
    </Section>
  );
}
