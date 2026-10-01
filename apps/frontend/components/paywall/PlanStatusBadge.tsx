import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SubscriptionStatus } from '@/services/paywall.service';

const STATUS_META: Record<
  SubscriptionStatus,
  { label: string; className: string }
> = {
  ACTIVE: {
    label: 'Active',
    className:
      'border-transparent bg-[var(--color-status-success)]/10 text-[var(--color-status-success)]',
  },
  GRACE: {
    label: 'Grace period',
    className:
      'border-transparent bg-[var(--color-status-warning)]/10 text-[var(--color-status-warning)]',
  },
  SUSPENDED: {
    label: 'Suspended',
    className:
      'border-transparent bg-[var(--color-status-critical)]/10 text-[var(--color-status-critical)]',
  },
};

export default function PlanStatusBadge({
  status,
  className,
}: {
  status: SubscriptionStatus;
  className?: string;
}) {
  const meta = STATUS_META[status] ?? STATUS_META.SUSPENDED;
  return (
    <Badge variant="outline" className={cn(meta.className, className)}>
      {meta.label}
    </Badge>
  );
}
