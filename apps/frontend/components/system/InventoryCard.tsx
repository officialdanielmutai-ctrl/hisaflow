import { cn } from '@/lib/utils'
import StatusDot from '@/components/system/StatusDot'

interface InventoryCardProps {
  name: string
  quantity: number
  unit: string
  status: 'success' | 'warning' | 'critical'
  category?: string
  className?: string
}

export default function InventoryCard({ name, quantity, unit, status, category, className }: InventoryCardProps) {
  return (
    <div className={cn('flex flex-col gap-3 rounded-xl bg-[var(--color-bg-surface)] p-4 shadow-sm', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{name}</p>
          {category ? (
            <span className="text-xs text-[var(--color-text-muted)]">{category}</span>
          ) : null}
        </div>
        <StatusDot status={status} />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-[var(--color-text-primary)]">{quantity}</span>
        <span className="text-sm text-[var(--color-text-secondary)]">{unit}</span>
      </div>
    </div>
  )
}
