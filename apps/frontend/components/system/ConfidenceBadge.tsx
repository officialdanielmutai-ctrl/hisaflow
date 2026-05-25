import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface ConfidenceBadgeProps {
  level: 'high' | 'medium' | 'low';
  className?: string;
}

const levelConfig: Record<ConfidenceBadgeProps['level'], { text: string; colorVar: string }> = {
  high: { text: 'Looks correct', colorVar: 'var(--color-status-success)' },
  medium: { text: 'Please review', colorVar: 'var(--color-status-warning)' },
  low: { text: 'Needs attention', colorVar: 'var(--color-status-critical)' },
};

export default function ConfidenceBadge({ level, className }: ConfidenceBadgeProps) {
  const { text, colorVar } = levelConfig[level];
  return (
    <Badge
      className={cn('text-white', className)}
      style={{ backgroundColor: colorVar }}
    >
      {text}
    </Badge>
  );
}
