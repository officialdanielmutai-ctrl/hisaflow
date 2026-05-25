import { cn } from '@/lib/utils';

interface StatusDotProps {
  status: 'success' | 'warning' | 'critical' | 'info' | 'neutral';
  className?: string;
}

export default function StatusDot({ status, className }: StatusDotProps) {
  return (
    <span
      className={cn('inline-block h-2 w-2 rounded-full shrink-0', className)}
      style={{ backgroundColor: `var(--color-status-${status})` }}
    />
  );
}
