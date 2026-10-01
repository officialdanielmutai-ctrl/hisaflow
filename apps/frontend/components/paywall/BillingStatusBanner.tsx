'use client';

import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';
import { format } from 'date-fns';
import { AlertTriangle, Clock, Info } from 'lucide-react';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { getSubscription } from '@/services/paywall.service';

/**
 * In-app billing status messaging (Phase C / Section 2.4). Surfaces the
 * reminder, retry window and GRACE state on every dashboard page, so an
 * overdue org is never silently locked out.
 */
export default function BillingStatusBanner() {
  const { getToken } = useAuth();
  const { membership, loading } = useMyOrganization();
  const organizationId = membership?.organization?.id ?? null;

  const { data } = useSWR(
    organizationId ? ['paywall-subscription', organizationId] : null,
    async () => {
      const token = await getToken();
      if (!token) return null;
      return getSubscription(token, organizationId as string);
    },
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  if (loading || !organizationId || !data) return null;

  const renewal = data.nextRenewalDate ? new Date(data.nextRenewalDate) : null;
  const now = new Date();
  const daysToRenewal = renewal
    ? Math.ceil((renewal.getTime() - now.getTime()) / 86_400_000)
    : null;
  const overdue =
    data.status === 'ACTIVE' &&
    data.paymentMethod === 'MPESA' &&
    renewal !== null &&
    renewal < now;

  if (data.status === 'SUSPENDED') {
    return (
      <Banner
        tone="critical"
        icon={<AlertTriangle className="h-4 w-4" />}
        title="Account suspended"
        body="Your subscription is suspended. Renew to restore access."
      />
    );
  }

  if (data.status === 'GRACE') {
    return (
      <Banner
        tone="critical"
        icon={<AlertTriangle className="h-4 w-4" />}
        title="Payment needed"
        body={
          data.graceEndsAt
            ? `We could not collect your renewal. Access continues until ${format(new Date(data.graceEndsAt), 'd MMM yyyy')}.`
            : 'We could not collect your renewal. Update your payment method to avoid lockout.'
        }
      />
    );
  }

  if (overdue) {
    return (
      <Banner
        tone="warning"
        icon={<Clock className="h-4 w-4" />}
        title="Renewal in progress"
        body="Your M-Pesa renewal is due. We retry on the due date, then day 2 and day 4."
      />
    );
  }

  if (
    data.paymentMethod === 'MPESA' &&
    daysToRenewal !== null &&
    daysToRenewal >= 0 &&
    daysToRenewal <= 3
  ) {
    return (
      <Banner
        tone="info"
        icon={<Info className="h-4 w-4" />}
        title="Upcoming M-Pesa renewal"
        body={
          daysToRenewal === 0
            ? 'Your plan renews today. Watch for the M-Pesa prompt.'
            : `Your plan renews in ${daysToRenewal} day${daysToRenewal === 1 ? '' : 's'}.`
        }
      />
    );
  }

  return null;
}

function Banner({
  tone,
  icon,
  title,
  body,
}: {
  tone: 'info' | 'warning' | 'critical';
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  const styles =
    tone === 'critical'
      ? 'border-[var(--color-status-critical)]/30 bg-[var(--color-status-critical)]/10'
      : tone === 'warning'
        ? 'border-[var(--color-status-warning)]/30 bg-[var(--color-status-warning)]/10'
        : 'border-[var(--color-accent-blue)]/30 bg-[var(--color-accent-blue)]/10';
  const text =
    tone === 'critical'
      ? 'text-[var(--color-status-critical)]'
      : tone === 'warning'
        ? 'text-[var(--color-status-warning)]'
        : 'text-[var(--color-accent-blue)]';

  return (
    <Link
      href="/settings/billing"
      className={`mb-4 flex items-start gap-3 rounded-2xl border p-3 ${styles}`}
    >
      <span className={`mt-0.5 shrink-0 ${text}`}>{icon}</span>
      <span>
        <span className={`block text-sm font-semibold ${text}`}>{title}</span>
        <span className="mt-0.5 block text-xs text-[var(--color-text-secondary)]">
          {body}
        </span>
      </span>
    </Link>
  );
}
