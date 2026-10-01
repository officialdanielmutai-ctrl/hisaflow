import { Suspense } from 'react';
import PaywallClient from '@/components/paywall/PaywallClient';

export default function PaywallPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-[var(--color-text-secondary)]">
          Loading plans
        </div>
      }
    >
      <PaywallClient />
    </Suspense>
  );
}
