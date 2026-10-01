import { CreditCard, Smartphone, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SubscriptionPaymentMethod } from '@/services/paywall.service';

interface PaymentMethodSelectorProps {
  value: SubscriptionPaymentMethod;
  onChange: (method: SubscriptionPaymentMethod) => void;
  /** Phase C wires M-Pesa. Until then it is visible but not selectable. */
  mpesaEnabled?: boolean;
  disabled?: boolean;
}

export default function PaymentMethodSelector({
  value,
  onChange,
  mpesaEnabled = false,
  disabled = false,
}: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-3">
      {/* M-Pesa first per Section 2.3 — the primary rail for this audience. */}
      <MethodOption
        title="M-Pesa"
        subtitle="Complete Paystack checkout, then approve the prompt on your phone"
        icon={<Smartphone className="h-5 w-5" />}
        selected={value === 'MPESA'}
        disabled={disabled || !mpesaEnabled}
        tag={mpesaEnabled ? undefined : 'Coming soon'}
        onClick={() => onChange('MPESA')}
      />
      <MethodOption
        title="Card"
        subtitle="Visa or Mastercard · renews automatically"
        icon={<CreditCard className="h-5 w-5" />}
        selected={value === 'CARD'}
        disabled={disabled}
        onClick={() => onChange('CARD')}
      />
    </div>
  );
}

function MethodOption({
  title,
  subtitle,
  icon,
  selected,
  disabled,
  tag,
  onClick,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  selected: boolean;
  disabled?: boolean;
  tag?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all',
        selected
          ? 'border-[var(--color-accent)] bg-[var(--color-bg-secondary)]'
          : 'border-[var(--color-border)] bg-[var(--color-bg-surface)]',
        disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-[var(--color-accent)]/60',
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          selected
            ? 'bg-[var(--color-accent)] text-white'
            : 'bg-[var(--color-bg-base)] text-[var(--color-text-secondary)]',
        )}
      >
        {icon}
      </span>
      <span className="flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
            {title}
          </span>
          {tag && (
            <span className="rounded-full bg-[var(--color-bg-elevated)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              {tag}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs text-[var(--color-text-secondary)]">
          {subtitle}
        </span>
      </span>
      {selected && <Check className="h-5 w-5 shrink-0 text-[var(--color-accent)]" />}
    </button>
  );
}
