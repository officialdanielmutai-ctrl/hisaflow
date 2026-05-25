import cn from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface OperationalSummaryProps {
  label: string
  value: string
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
  className?: string
}

export default function OperationalSummary({ label, value, trend, trendLabel, className }: OperationalSummaryProps) {
  const trendColorMap = {
    up: '--color-status-success',
    down: '--color-status-critical',
    neutral: '--color-text-muted',
  }

  const trendColor = trend ? trendColorMap[trend] : undefined

  return (
    <div className={cn('flex flex-col gap-1 rounded-xl bg-[var(--color-bg-surface)] p-4 shadow-sm', className)}>
      <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
      {trend && trendLabel ? (
        <div className="flex items-center gap-1">
          {trend === 'up' ? (
            <TrendingUp className="h-3 w-3 text-[var(--color-status-success)]" />
          ) : trend === 'down' ? (
            <TrendingDown className="h-3 w-3 text-[var(--color-status-critical)]" />
          ) : null}
          <span style={{ color: `var(${trendColor})` }} className="text-xs">
            {trendLabel}
          </span>
        </div>
      ) : null}
    </div>
  )
}
