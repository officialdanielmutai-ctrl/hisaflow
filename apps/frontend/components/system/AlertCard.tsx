import cn from '@/lib/utils'
import StatusDot from '@/components/system/StatusDot'

interface AlertCardProps {
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  actionLabel?: string
  className?: string
}

export default function AlertCard({ severity, title, description, actionLabel, className }: AlertCardProps) {
  const borderColor = `var(--color-status-${severity})`

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border-l-4 bg-[var(--color-bg-surface)] p-4 shadow-sm',
        className
      )}
      style={{ borderLeftColor: borderColor }}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">{title}</p>
        <StatusDot status={severity} />
      </div>
      <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>
      {actionLabel ? (
        <span className="w-fit cursor-pointer text-xs font-medium text-[var(--color-accent)]">
          {actionLabel}
        </span>
      ) : null}
    </div>
  )
}
