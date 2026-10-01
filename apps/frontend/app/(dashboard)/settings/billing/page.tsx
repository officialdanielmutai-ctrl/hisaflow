'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';
import { format } from 'date-fns';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarClock,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  Receipt,
  Smartphone,
  Users,
} from 'lucide-react';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import {
  changePaymentMethod,
  changePlan,
  getInvoices,
  getPaywallPlans,
  getSubscription,
  updateSeats,
  type PaymentMethodResult,
  type PaywallPlan,
  type SubscriptionPaymentMethod,
} from '@/services/paywall.service';
import { formatCurrency } from '@/lib/utils';
import PlanStatusBadge from '@/components/paywall/PlanStatusBadge';
import {
  additionalSeatsFrom,
  clampAdditionalSeats,
  describeInvoiceStatus,
  planChangeDirection,
  TIER_ORDER,
} from '@/lib/billing';

const METHOD_LABELS: Record<string, string> = {
  CARD: 'Card (Visa / Mastercard)',
  MPESA: 'M-Pesa',
};

export default function BillingSettingsPage() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const organizationId = membership?.organization?.id ?? null;

  const {
    data: subscription,
    isLoading,
    mutate: mutateSubscription,
  } = useSWR(
    organizationId ? ['paywall-subscription', organizationId] : null,
    async () => {
      const token = await getToken();
      if (!token) return null;
      return getSubscription(token, organizationId as string);
    },
  );

  const { data: plans } = useSWR(
    organizationId ? ['paywall-plans', organizationId] : null,
    async () => {
      const token = await getToken();
      if (!token) return [];
      return getPaywallPlans(token, organizationId as string);
    },
  );

  const { data: invoices, mutate: mutateInvoices } = useSWR(
    organizationId && subscription ? ['paywall-invoices', organizationId] : null,
    async () => {
      const token = await getToken();
      if (!token) return [];
      return getInvoices(token, organizationId as string);
    },
  );

  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mpesaPhone, setMpesaPhone] = useState('');

  if (isLoading) {
    return (
      <div className="space-y-6 pb-24">
        <div className="h-56 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="space-y-6 pb-24">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Your current plan, seats and renewal.
          </p>
        </header>
        <section className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-surface)] p-8 text-center">
          <CreditCard className="mx-auto h-9 w-9 text-[var(--color-text-muted)]" />
          <p className="mt-3 font-semibold">No active plan</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Choose a plan to unlock the full product.
          </p>
          <Link
            href="/paywall"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[var(--color-accent)] px-6 text-sm font-semibold text-white"
          >
            Choose a plan
          </Link>
        </section>
      </div>
    );
  }

  const plan = subscription.plan;
  const additionalSeats = additionalSeatsFrom(
    subscription.seatAllowance,
    plan.seatAllowance,
  );

  const withBusy = async (key: string, run: () => Promise<void>) => {
    setBusy(key);
    setNotice(null);
    setError(null);
    try {
      await run();
    } catch (err) {
      // FeatureLockedError has already redirected to the paywall.
      if (err instanceof Error && err.name !== 'FeatureLockedError') {
        setError(err.message);
      }
    } finally {
      setBusy(null);
    }
  };

  const handleChangePlan = (target: PaywallPlan) =>
    withBusy(`plan-${target.tier}`, async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const result = await changePlan(token, organizationId as string, target.tier);
      if (result.action === 'checkout' && result.authorizationUrl) {
        window.location.assign(result.authorizationUrl);
        return;
      }
      // Make the deferred downgrade explicit, with the actual date.
      if (result.mode === 'scheduled' && result.effectiveAt) {
        setNotice(
          `Downgrade scheduled. You keep ${plan.name} until ${format(
            new Date(result.effectiveAt),
            'd MMM yyyy',
          )}, then move to ${target.name}.`,
        );
      } else {
        setNotice(result.message);
      }
      await mutateSubscription();
    });

  const handleSeatDelta = (delta: number) =>
    withBusy('seats', async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const next = clampAdditionalSeats(additionalSeats, delta);
      const result = await updateSeats(token, organizationId as string, next);
      setNotice(result.message);
      await mutateSubscription();
    });

  const handlePaymentMethod = (
    method: SubscriptionPaymentMethod,
    phone?: string,
  ) =>
    withBusy(`method-${method}`, async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const result: PaymentMethodResult = await changePaymentMethod(
        token,
        organizationId as string,
        { method, mpesaPhone: phone },
      );
      if ((result.url || result.authorizationUrl) && typeof window !== 'undefined') {
        window.location.assign(result.url ?? result.authorizationUrl!);
        return;
      }
      setNotice(result.message);
      await mutateSubscription();
      await mutateInvoices();
    });

  return (
    <div className="space-y-6 pb-24">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Your current plan, seats and renewal.
        </p>
      </header>

      {subscription.status === 'ACTIVE' &&
        subscription.paymentMethod === 'MPESA' &&
        subscription.nextRenewalDate &&
        new Date(subscription.nextRenewalDate) < new Date() && (
          <Banner tone="warning" title="Renewal in progress">
            Your M-Pesa renewal is due. We retry on the due date, then day 2 and
            day 4 before any lockout.
          </Banner>
        )}

      {subscription.status === 'GRACE' && (
        <Banner tone="warning" title="Payment needed">
          Your last renewal did not complete after our retries on day 0, day 2
          and day 4.
          {subscription.graceEndsAt
            ? ` Access continues until ${format(new Date(subscription.graceEndsAt), 'd MMM yyyy')}.`
            : ' Please update your payment method.'}
        </Banner>
      )}

      {notice && <Banner tone="success" title="Done">{notice}</Banner>}
      {error && <Banner tone="danger" title="Could not complete that">{error}</Banner>}

      {/* Current plan */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Current plan
            </p>
            <h2 className="mt-1 text-xl font-bold text-[var(--color-text-primary)]">
              {plan.name}
            </h2>
          </div>
          <PlanStatusBadge status={subscription.status} />
        </div>

        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-2xl font-bold">
            {formatCurrency(Number(plan.priceKes), 'KES')}
          </span>
          <span className="text-xs text-[var(--color-text-secondary)]">
            / month
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <InfoTile
            icon={<Users className="h-4 w-4" />}
            label="Seats"
            value={`${subscription.seatCount} of ${subscription.seatAllowance}`}
          />
          <InfoTile
            icon={<CalendarClock className="h-4 w-4" />}
            label="Next renewal"
            value={
              subscription.nextRenewalDate
                ? format(new Date(subscription.nextRenewalDate), 'd MMM yyyy')
                : 'Not scheduled'
            }
          />
          <InfoTile
            icon={<CreditCard className="h-4 w-4" />}
            label="Payment method"
            value={METHOD_LABELS[subscription.paymentMethod] ?? subscription.paymentMethod}
          />
        </div>

        {subscription.pendingTier && subscription.pendingPlanEffectiveAt && (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-[var(--color-status-warning)]/30 bg-[var(--color-status-warning)]/10 p-3">
            <ArrowDownCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-status-warning)]" />
            <p className="text-sm text-[var(--color-text-secondary)]">
              Scheduled downgrade to{' '}
              <span className="font-semibold text-[var(--color-text-primary)]">
                {subscription.pendingTier}
              </span>{' '}
              on{' '}
              {format(new Date(subscription.pendingPlanEffectiveAt), 'd MMM yyyy')}.
              You keep your current plan until then.
            </p>
          </div>
        )}
      </section>

      {/* Change plan */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          Change plan
        </h2>
        <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
          Upgrades start immediately. Downgrades take effect at your next
          renewal — you keep the higher tier until the cycle ends.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(plans ?? [])
            .slice()
            .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier))
            .map((candidate) => {
              const direction = planChangeDirection(plan.tier, candidate.tier);
              const isCurrent = direction === 'same';
              return (
                <div
                  key={candidate.tier}
                  className="flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-4"
                >
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {candidate.name}
                  </p>
                  <p className="mt-1 text-lg font-bold">
                    {formatCurrency(Number(candidate.priceKes), 'KES')}
                    <span className="text-xs font-normal text-[var(--color-text-secondary)]">
                      {' '}
                      / mo
                    </span>
                  </p>
                  <p className="mt-1 flex-1 text-xs text-[var(--color-text-secondary)]">
                    {isCurrent
                      ? 'Your current plan'
                      : direction === 'upgrade'
                        ? 'Takes effect immediately'
                        : subscription.nextRenewalDate
                          ? `Takes effect on ${format(
                              new Date(subscription.nextRenewalDate),
                              'd MMM yyyy',
                            )}`
                          : 'Takes effect at your next renewal'}
                  </p>
                  {!isCurrent && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => handleChangePlan(candidate)}
                      className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {busy === `plan-${candidate.tier}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : direction === 'upgrade' ? (
                        <ArrowUpCircle className="h-4 w-4" />
                      ) : (
                        <ArrowDownCircle className="h-4 w-4" />
                      )}
                      {direction === 'upgrade' ? 'Upgrade' : 'Downgrade'}
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      </section>

      {/* Seats */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          Seats
        </h2>
        <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
          {subscription.seatCount} used of {subscription.seatAllowance}. Extra
          seats are billed on your next cycle.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            aria-label="Remove a seat"
            disabled={busy !== null || additionalSeats === 0}
            onClick={() => handleSeatDelta(-1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border)] disabled:opacity-40"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-[7rem] text-center text-sm font-semibold">
            {subscription.seatAllowance} seats
            {additionalSeats > 0 ? ` (${additionalSeats} extra)` : ''}
          </span>
          <button
            type="button"
            aria-label="Add a seat"
            disabled={busy !== null}
            onClick={() => handleSeatDelta(1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border)] disabled:opacity-40"
          >
            {busy === 'seats' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </button>
        </div>
      </section>

      {/* Payment method */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          Payment method
        </h2>
        <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
          Current: {METHOD_LABELS[subscription.paymentMethod]}.
        </p>

        {subscription.paymentMethod === 'CARD' ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => handlePaymentMethod('CARD')}
            className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-5 text-sm font-semibold disabled:opacity-50"
          >
            <CreditCard className="h-4 w-4" />
            Update card
          </button>
        ) : (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm">
              <span className="text-xs font-medium text-[var(--color-text-muted)]">
                M-Pesa number
              </span>
              <input
                type="tel"
                inputMode="tel"
                placeholder="07XX XXX XXX"
                value={mpesaPhone}
                onChange={(e) => setMpesaPhone(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 text-sm outline-none focus:border-[var(--color-accent)]"
              />
            </label>
            <button
              type="button"
              disabled={busy !== null || !/^(\+?254|0)(7|1)\d{8}$/.test(mpesaPhone)}
              onClick={() => handlePaymentMethod('MPESA', mpesaPhone)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-5 text-sm font-semibold disabled:opacity-50"
            >
              <Smartphone className="h-4 w-4" />
              Update number
            </button>
          </div>
        )}

        <div className="mt-4 border-t border-[var(--color-border)] pt-4">
          <p className="text-xs text-[var(--color-text-muted)]">
            Switch payment rail
          </p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              handlePaymentMethod(
                subscription.paymentMethod === 'CARD' ? 'MPESA' : 'CARD',
                subscription.paymentMethod === 'CARD' ? mpesaPhone : undefined,
              )
            }
            className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {subscription.paymentMethod === 'CARD' ? (
              <Smartphone className="h-4 w-4" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            Switch to {subscription.paymentMethod === 'CARD' ? 'M-Pesa' : 'Card'}
          </button>
        </div>
      </section>

      {/* Invoice history */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--color-text-primary)]">
          <Receipt className="h-4 w-4" />
          Receipts
        </h2>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          {(invoices ?? []).some((invoice) => invoice.source === 'paystack')
            ? 'Synced from Paystack transactions'
            : 'Local payment records (Paystack not reachable)'}
        </p>
        {(invoices ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            No payments recorded yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--color-border)]">
            {(invoices ?? []).map((invoice) => {
              const status = describeInvoiceStatus(invoice.status);
              return (
                <li
                  key={invoice.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {formatCurrency(invoice.amountKes, 'KES')}
                      <span className="ml-2 text-xs font-normal text-[var(--color-text-secondary)]">
                        {invoice.planName ?? 'Plan'}
                      </span>
                    </p>
                    <p className="truncate text-xs text-[var(--color-text-muted)]">
                      {METHOD_LABELS[invoice.method] ?? invoice.method} ·{' '}
                      {format(new Date(invoice.attemptedAt), 'd MMM yyyy')}
                      {invoice.reference ? ` · ${invoice.reference}` : ''}
                    </p>
                  </div>
                  <span
                    className={
                      status.tone === 'success'
                        ? 'text-xs font-semibold text-[var(--color-status-success)]'
                        : status.tone === 'danger'
                          ? 'text-xs font-semibold text-[var(--color-status-critical)]'
                          : 'text-xs font-semibold text-[var(--color-status-warning)]'
                    }
                  >
                    {status.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-center text-xs text-[var(--color-text-muted)]">
        Payments are processed securely by Paystack.
      </p>
    </div>
  );
}

function Banner({
  tone,
  title,
  children,
}: {
  tone: 'success' | 'warning' | 'danger';
  title: string;
  children: React.ReactNode;
}) {
  const color =
    tone === 'success'
      ? 'var(--color-status-success)'
      : tone === 'danger'
        ? 'var(--color-status-critical)'
        : 'var(--color-status-warning)';
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
      }}
    >
      <p className="text-sm font-semibold" style={{ color }}>
        {title}
      </p>
      <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
        {children}
      </p>
    </div>
  );
}

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-[var(--color-bg-base)] px-3 py-3">
      <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
        {value}
      </p>
    </div>
  );
}
