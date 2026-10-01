import { Lock } from 'lucide-react';
import { resolvePaywallContext } from '@/lib/paywall-context';

/**
 * Renders the specific blocked action when the paywall is reached from a gate.
 * The mapping lives in `lib/paywall-context.ts` so the context chain is testable
 * independently of this component.
 */
export default function PaywallContextBanner({
  feature,
  reason,
}: {
  feature?: string;
  reason?: string;
}) {
  const context = resolvePaywallContext({ feature, reason });
  if (!context) return null;

  return (
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-bg-secondary)] p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-white">
        <Lock className="h-4 w-4" />
      </span>
      <div>
        <p className="font-semibold text-[var(--color-text-primary)]">
          {context.title}
        </p>
        <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
          {context.body}
        </p>
      </div>
    </div>
  );
}
