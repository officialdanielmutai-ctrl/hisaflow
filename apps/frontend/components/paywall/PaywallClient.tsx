'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';
import { Loader2, ShieldCheck, Wallet } from 'lucide-react';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { normalizePlanIntent } from '@/lib/plans';
import {
  getPaywallPlans,
  getSubscription,
  startCardCheckout,
  startMpesaCheckout,
  type HisaflowPlanTier,
  type PaywallPlan,
  type SubscriptionPaymentMethod,
} from '@/services/paywall.service';
import { formatCurrency } from '@/lib/utils';
import TierCard from './TierCard';
import PaymentMethodSelector from './PaymentMethodSelector';
import PaywallContextBanner from './PaywallContextBanner';
import PaymentConfirmation from './PaymentConfirmation';

const TIER_ORDER: HisaflowPlanTier[] = ['SOLO', 'TEAM', 'GROWTH'];

/**
 * Growth has no price in the doc set (Section 7 only fixes Solo and Team), so
 * the backend does not provision or return it. The card is still rendered as a
 * three-tier layout per Section 2.2, but honestly marked Custom — never a
 * fabricated figure. It becomes a normal selectable card automatically once the
 * business prices and activates the tier.
 */
const GROWTH_TEASER: PaywallPlan = {
  id: 'growth-teaser',
  tier: 'GROWTH',
  name: 'Growth',
  description: null,
  priceKes: 0,
  billingInterval: 'MONTHLY',
  seatAllowance: 100,
  paystackPlanCode: null,
  isActive: false,
};

export default function PaywallClient() {
  const searchParams = useSearchParams();
  const reference = searchParams.get('reference') ?? searchParams.get('trxref');

  if (reference) {
    // Returning from Paystack checkout — show the authoritative-signal wait.
    return <PaymentConfirmation reference={reference} />;
  }

  return (
    <PlanChooser
      feature={searchParams.get('feature') ?? undefined}
      reason={searchParams.get('reason') ?? undefined}
    />
  );
}

function PlanChooser({
  feature,
  reason,
}: {
  feature?: string;
  reason?: string;
}) {
  const { getToken } = useAuth();
  const { membership, loading: orgLoading } = useMyOrganization();
  const organizationId = membership?.organization?.id ?? null;

  const {
    data: plans,
    isLoading: plansLoading,
    error: plansError,
  } = useSWR(
    organizationId ? ['paywall-plans', organizationId] : null,
    async () => {
      const token = await getToken();
      if (!token) return [];
      return getPaywallPlans(token, organizationId as string);
    },
  );

  const { data: subscription, isLoading: subscriptionLoading } = useSWR(
    organizationId ? ['paywall-subscription', organizationId] : null,
    async () => {
      const token = await getToken();
      if (!token) return null;
      return getSubscription(token, organizationId as string);
    },
  );

  const [selectedTier, setSelectedTier] = useState<HisaflowPlanTier>('TEAM');
  // Section 2.3: M-Pesa is the primary rail for this audience — present and
  // select it first, with card as the clearly available alternative.
  const [method, setMethod] = useState<SubscriptionPaymentMethod>('MPESA');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Layer L-D: the tier chosen on the public pricing page is stored on the
  // organization as a preference and pre-selected here. It never starts a
  // purchase on its own; missing or invalid intent degrades to the default.
  const preferredTier = membership?.organization?.preferredPlan;
  useEffect(() => {
    const tier = normalizePlanIntent(preferredTier);
    if (tier) {
      setSelectedTier(tier);
    }
  }, [preferredTier]);

  const orderedPlans = useMemo(() => {
    const list = plans ?? [];
    const byTier = new Map(list.map((plan) => [plan.tier, plan]));
    return TIER_ORDER.map(
      (tier) =>
        byTier.get(tier) ??
        (tier === 'GROWTH' && list.length > 0 ? GROWTH_TEASER : undefined),
    ).filter((plan): plan is PaywallPlan => Boolean(plan));
  }, [plans]);

  const hasSubscription = Boolean(subscription);
  const selectedPlan = orderedPlans.find((plan) => plan.tier === selectedTier);
  const mpesaPhoneValid = /^(\+?254|0)(7|1)\d{8}$/.test(mpesaPhone.trim());

  const handleContinue = async () => {
    if (!organizationId) return;

    // Phase B/C is first-payment only. Changing an existing subscription is
    // Phase E, so route to billing rather than risk a duplicate subscription.
    if (hasSubscription) {
      window.location.href = '/settings/billing';
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      // Card and M-Pesa are separate code paths (and separate backend
      // endpoints). M-Pesa goes through Paystack's checkout page first.
      const result =
        method === 'MPESA'
          ? await startMpesaCheckout(token, organizationId, {
              tier: selectedTier,
              mpesaPhone: mpesaPhone.trim(),
              callbackUrl: `${window.location.origin}/paywall`,
            })
          : await startCardCheckout(token, organizationId, {
              tier: selectedTier,
              callbackUrl: `${window.location.origin}/paywall`,
            });

      window.location.href = result.authorizationUrl;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not start checkout',
      );
      setSubmitting(false);
    }
  };

  if (orgLoading) {
    return <CenteredSpinner />;
  }

  if (!organizationId) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="font-semibold text-[var(--color-text-primary)]">
          No business selected
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Create or join a business before choosing a plan.
        </p>
        <Link
          href="/onboarding"
          className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-[var(--color-accent)] px-6 text-sm font-semibold text-white"
        >
          Go to onboarding
        </Link>
      </div>
    );
  }

  const isGrowthTeaser = (plan: PaywallPlan) =>
    plan.tier === 'GROWTH' && !plan.isActive;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
          Choose your plan
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Simple monthly pricing in KES. Change it whenever your business
          changes.
        </p>
      </header>

      <PaywallContextBanner feature={feature} reason={reason} />

      {hasSubscription && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
          <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-accent)]" />
          <div>
            <p className="font-semibold text-[var(--color-text-primary)]">
              You are on the {subscription?.plan?.name} plan
            </p>
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
              Manage seats, payment method and plan changes in Billing.
            </p>
          </div>
        </div>
      )}

      {plansError && (
        <div className="mb-5 rounded-2xl border border-[var(--color-status-critical)]/30 bg-[var(--color-status-critical)]/10 p-4 text-sm text-[var(--color-status-critical)]">
          Could not load plans. Please refresh and try again.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-3">
        {plansLoading
          ? TIER_ORDER.map((tier) => (
              <div
                key={tier}
                className="h-80 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]"
              />
            ))
          : orderedPlans.map((plan) => (
              <TierCard
                key={plan.tier}
                plan={plan}
                recommended={plan.tier === 'TEAM'}
                selected={selectedTier === plan.tier}
                comingSoon={isGrowthTeaser(plan)}
                badgeLabel={
                  subscription?.plan?.tier === plan.tier
                    ? 'Current plan'
                    : undefined
                }
                ctaLabel={
                  isGrowthTeaser(plan)
                    ? 'Contact us'
                    : selectedTier === plan.tier
                      ? 'Selected'
                      : `Choose ${plan.name}`
                }
                onSelect={
                  hasSubscription || isGrowthTeaser(plan)
                    ? undefined
                    : () => setSelectedTier(plan.tier)
                }
              />
            ))}
      </div>

      {!plansLoading && !plansError && orderedPlans.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-text-secondary)]">
          No plans are available right now. Please try again shortly.
        </div>
      )}

      {!subscriptionLoading && !hasSubscription && (
        <section className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            Payment method
          </h2>
          <p className="mb-4 mt-0.5 text-sm text-[var(--color-text-secondary)]">
            Cards renew automatically. M-Pesa uses Paystack&apos;s checkout page,
            then a prompt on your phone.
          </p>

          <PaymentMethodSelector
            value={method}
            onChange={setMethod}
            mpesaEnabled
          />

          {method === 'MPESA' && (
            <div className="mt-4 space-y-3">
              <div>
                <label
                  htmlFor="mpesa-phone"
                  className="text-sm font-medium text-[var(--color-text-primary)]"
                >
                  M-Pesa phone number
                </label>
                <input
                  id="mpesa-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="07XX XXX XXX"
                  value={mpesaPhone}
                  onChange={(event) => setMpesaPhone(event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 text-sm outline-none focus:border-[var(--color-accent)]"
                />
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Saved for future renewals. Paystack may ask you to confirm it
                  again on its checkout page.
                </p>
              </div>

              {/* Section 3.3: the Paystack checkout page is a real, visible
                  step before the STK prompt — do not imply an instant prompt. */}
              <div className="rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-bg-secondary)] p-3">
                <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                  How M-Pesa works here
                </p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-xs text-[var(--color-text-secondary)]">
                  <li>You continue to Paystack&apos;s secure checkout page.</li>
                  <li>Select M-Pesa and enter your number there.</li>
                  <li>
                    Only then does the STK prompt arrive on your phone —
                    approve it.
                  </li>
                  <li>Your plan activates once we receive confirmation.</li>
                </ol>
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between rounded-xl bg-[var(--color-bg-base)] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {selectedPlan?.name ?? 'Select a plan'}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {method === 'MPESA'
                  ? 'Charged monthly via an M-Pesa prompt'
                  : 'Billed monthly, cancel anytime'}
              </p>
            </div>
            {selectedPlan && Number(selectedPlan.priceKes) > 0 && (
              <p className="text-sm font-bold text-[var(--color-text-primary)]">
                {formatCurrency(Number(selectedPlan.priceKes), 'KES')}
                <span className="font-normal text-[var(--color-text-secondary)]">
                  {' '}
                  / mo
                </span>
              </p>
            )}
          </div>

          {error && (
            <p className="mt-3 text-sm text-[var(--color-status-critical)]">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleContinue}
            disabled={
              submitting ||
              !selectedPlan ||
              Number(selectedPlan.priceKes) <= 0 ||
              (method === 'MPESA' && !mpesaPhoneValid)
            }
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting secure checkout
              </>
            ) : (
              'Continue to payment'
            )}
          </button>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-[var(--color-text-muted)]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secured by Paystack. Your subscription activates as soon as payment
            is confirmed.
          </p>
        </section>
      )}

      {hasSubscription && (
        <div className="mt-6">
          <Link
            href="/settings/billing"
            className="flex h-11 items-center justify-center rounded-xl bg-[var(--color-accent)] text-sm font-semibold text-white"
          >
            Manage billing
          </Link>
        </div>
      )}
    </div>
  );
}

function CenteredSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--color-accent)]" />
    </div>
  );
}
