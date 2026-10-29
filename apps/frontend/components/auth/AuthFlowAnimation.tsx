import { CalendarDays, Package, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

const CHIPS = [
  {
    icon: Package,
    label: 'Stock',
    className: 'left-0 top-[24%]',
    delay: '0s',
  },
  {
    icon: Wallet,
    label: 'M-Pesa',
    className: 'right-3 top-[47%]',
    delay: '0.8s',
  },
  {
    icon: CalendarDays,
    label: 'Bookings',
    className: 'left-[7%] bottom-[10%]',
    delay: '1.6s',
  },
]

/**
 * Auth-page brand animation: the three operating surfaces orbit a central
 * HisaFlow core. Replaces the old static three-chevron motif; CSS keyframes
 * only, and all motion stops under `prefers-reduced-motion`.
 */
export function AuthFlowAnimation({ className }: { className?: string }) {
  return (
    <div className={cn('relative', className)} aria-hidden="true">
      <div className="absolute inset-[12%] rounded-full border border-white/10" />
      <div className="absolute inset-[25%] rounded-full border border-dashed border-white/15" />

      <div className="auth-flow-orbit absolute inset-[12%]">
        <span className="auth-flow-dot absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-white shadow-[0_0_18px_7px_rgba(255,255,255,0.35)]" />
      </div>

      <div className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[26px] border border-white/20 bg-white/10 shadow-[0_18px_60px_-20px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <span className="auth-flow-ring absolute inset-0 rounded-[26px] border border-white/20" />
        <span className="relative text-[26px] font-black tracking-tight text-white">
          HF
        </span>
      </div>

      {CHIPS.map(({ icon: Icon, label, className: position, delay }) => (
        <div
          key={label}
          className={cn(
            'auth-flow-chip absolute flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-semibold text-white/85 shadow-[0_12px_28px_-16px_rgba(0,0,0,0.55)] backdrop-blur-sm',
            position
          )}
          style={{ animationDelay: delay }}
        >
          <Icon className="h-4 w-4" strokeWidth={1.6} />
          {label}
        </div>
      ))}
    </div>
  )
}
