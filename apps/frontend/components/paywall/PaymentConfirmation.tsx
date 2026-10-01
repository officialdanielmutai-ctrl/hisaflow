'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';
import { CheckCircle2, Clock, Loader2, RefreshCw } from 'lucide-react';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { getSubscription } from '@/services/paywall.service';

/**
 * Post-checkout state (Section 2.4). The webhook is the authoritative signal,
 * so this does not treat the Paystack redirect as success — it polls the
 * HisaFlow Subscription row until the webhook has flipped it to ACTIVE.
 */
export default function PaymentConfirmation({
  reference,
}: {
  reference: string;
}) {
  const isMpesa = reference.startsWith('HF-MPESA');
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const organizationId = membership?.organization?.id ?? null;
  const [attempt, setAttempt] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  const { data, mutate } = useSWR(
    organizationId ? ['payment-confirmation', organizationId, attempt] : null,
    async () => {
      const token = await getToken();
      if (!token) return null;
      return getSubscription(token, organizationId as string);
    },
    {
      refreshInterval: (latest) =>
        latest?.status === 'ACTIVE' ? 0 : 3000,
      revalidateOnFocus: true,
    },
  );

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 90_000);
    return () => clearTimeout(timer);
  }, [attempt]);

  const active = data?.status === 'ACTIVE';

  const handleRetry = () => {
    setTimedOut(false);
    setAttempt((value) => value + 1);
    mutate();
  };

  if (active) {
    return (
      <StatusShell
        icon={<CheckCircle2 className="h-8 w-8 text-[var(--color-status-success)]" />}
        tone="success"
        title="Payment confirmed"
        body={`You are now on the ${data?.plan?.name ?? 'selected'} plan. Your subscription is active.`}
      >
        <Link
          href="/"
          className="mt-5 flex h-11 items-center justify-center rounded-xl bg-[var(--color-accent)] px-6 text-sm font-semibold text-white"
        >
          Go to dashboard
        </Link>
      </StatusShell>
    );
  }

  if (timedOut) {
    return (
      <StatusShell
        icon={<Clock className="h-8 w-8 text-[var(--color-status-warning)]" />}
        tone="warning"
        title="Still waiting for confirmation"
        body={
          isMpesa
            ? 'We have not received the M-Pesa confirmation yet. If you approved the prompt, it can take a moment. You can try the payment again.'
            : 'We have not received Paystack\u2019s confirmation yet. If you completed the payment, it can take a moment. You can also try again with a different payment method.'
        }
      >
        <button
          type="button"
          onClick={handleRetry}
          className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] text-sm font-semibold"
        >
          <RefreshCw className="h-4 w-4" />
          Check again
        </button>
        <Link
          href="/paywall"
          className="mt-3 flex h-11 w-full items-center justify-center rounded-xl bg-[var(--color-accent)] text-sm font-semibold text-white"
        >
          Try again
        </Link>
      </StatusShell>
    );
  }

  return (
    <StatusShell
      icon={<Loader2 className="h-8 w-8 animate-spin text-[var(--color-accent)]" />}
      tone="pending"
      title={isMpesa ? 'Approve the M-Pesa prompt' : 'Confirming your payment'}
      body={
        isMpesa
          ? 'Finish Paystack\u2019s checkout, then approve the STK prompt on your phone. This page updates the moment we receive confirmation.'
          : 'Waiting for Paystack to confirm. This usually takes a few seconds — please keep this page open.'
      }
    />
  );
}

function StatusShell({
  icon,
  title,
  body,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone: 'success' | 'warning' | 'pending';
  children?: React.ReactNode;
}) {
  const ring =
    tone === 'success'
      ? 'bg-[var(--color-status-success)]/10'
      : tone === 'warning'
        ? 'bg-[var(--color-status-warning)]/10'
        : 'bg-[var(--color-bg-secondary)]';

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <div className="flex flex-col items-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 text-center shadow-[var(--shadow-card)]">
        <span className={`flex h-16 w-16 items-center justify-center rounded-full ${ring}`}>
          {icon}
        </span>
        <h1 className="mt-4 text-lg font-bold text-[var(--color-text-primary)]">
          {title}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{body}</p>
        <div className="w-full">{children}</div>
      </div>
    </div>
  );
}
