import { cn } from '@/lib/utils'

/**
 * Glass-tube liquid progress fill.
 *
 * The structure is deliberately small: a recessed track, a 3D gradient fill
 * with an internal specular highlight and a wobbling meniscus, plus bubbles
 * that rise through the fluid rather than sitting on top of the leading edge.
 * All motion is CSS-only so it stays cheap inside the KPI grid, and the
 * reduced-motion rule in `globals.css` disables every animation.
 */
const BUBBLES = [
  { left: 7, size: 5, duration: 2.8, delay: 0.35, drift: 2 },
  { left: 19, size: 4, duration: 3.4, delay: 1.1, drift: -2 },
  { left: 33, size: 6, duration: 3.1, delay: 0.7, drift: 3 },
  { left: 48, size: 4, duration: 2.5, delay: 1.6, drift: 1 },
  { left: 63, size: 5, duration: 3.6, delay: 0.5, drift: -3 },
  { left: 77, size: 4, duration: 2.9, delay: 1.9, drift: 2 },
  { left: 90, size: 3, duration: 2.3, delay: 1.2, drift: -1 },
] as const

export interface LiquidProgressProps {
  value: number
  max?: number
  isHero?: boolean
  className?: string
  ariaLabel?: string
  showBubbles?: boolean
}

export function LiquidProgress({
  value,
  max = 100,
  isHero = false,
  className,
  ariaLabel = 'Progress',
  showBubbles = true,
}: LiquidProgressProps) {
  const safeMax = Math.max(max, 1)
  const pct = Math.min(Math.max((value / safeMax) * 100, 0), 100)

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      className={cn(
        'hf-liquid-track relative h-5 w-full overflow-hidden rounded-full border p-[2px] transition-shadow duration-300',
        isHero
          ? 'border-[var(--hf-accent-foreground)] bg-[var(--hf-accent-hover)]'
          : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)]',
        className
      )}
    >
      <div
        className="hf-liquid-fill relative h-full overflow-hidden rounded-full"
        style={{
          width: `${pct}%`,
          ['--liquid-fill-pct' as string]: `${pct}%`,
        }}
      >
        <span className="hf-liquid-meniscus" aria-hidden="true" />
        {showBubbles && pct > 8
          ? BUBBLES.map((bubble) => (
              <span
                key={`${bubble.left}-${bubble.size}`}
                className="hf-liquid-bubble"
                aria-hidden="true"
                style={{
                  left: `${bubble.left}%`,
                  width: `${bubble.size}px`,
                  height: `${bubble.size}px`,
                  animationDuration: `${bubble.duration}s`,
                  animationDelay: `${bubble.delay}s`,
                  ['--hf-bubble-drift' as string]: `${bubble.drift}px`,
                }}
              />
            ))
          : null}
      </div>
    </div>
  )
}
