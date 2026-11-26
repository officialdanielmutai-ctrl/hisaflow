import { cn } from '@/lib/utils'

/**
 * Glass-tube liquid progress fill.
 *
 * All motion and fluid maths are reflective of actual data:
 * - When `value <= 0` or `pct <= 0`, the tube is completely empty (no fill,
 *   no wobbling meniscus, no rising bubbles, no sheen).
 * - When `pct > 0`, the surge animation duration scales directly with the
 *   fluid volume, bubbles are distributed evenly across the real fluid body,
 *   and bubble count is mathematically proportional to the fill level.
 * All motion respects reduced-motion preferences.
 */
const BUBBLE_PRESETS = [
  { size: 5, duration: 2.8, delay: 0.35, drift: 2 },
  { size: 4, duration: 3.4, delay: 1.1, drift: -2 },
  { size: 6, duration: 3.1, delay: 0.7, drift: 3 },
  { size: 4, duration: 2.5, delay: 1.6, drift: 1 },
  { size: 5, duration: 3.6, delay: 0.5, drift: -3 },
  { size: 4, duration: 2.9, delay: 1.9, drift: 2 },
  { size: 3, duration: 2.3, delay: 1.2, drift: -1 },
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
  const isZero = pct <= 0

  // Bubble count scales directly with the fluid volume (0 below 15%, up to 7 at 100%)
  const bubbleCount = isZero || pct < 15 ? 0 : Math.min(7, Math.max(1, Math.round((pct / 100) * 7)))
  const activeBubbles = BUBBLE_PRESETS.slice(0, bubbleCount)

  // Fluid surge duration scales with volume distance so small fills don't drag
  const surgeDuration = isZero ? 0 : Math.max(0.35, Number(((pct / 100) * 1.2).toFixed(2)))

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
      {!isZero && (
        <div
          className="hf-liquid-fill relative h-full overflow-hidden rounded-full"
          style={{
            width: `${pct}%`,
            ['--liquid-fill-pct' as string]: `${pct}%`,
            animationDuration: `${surgeDuration}s`,
          }}
        >
          <span className="hf-liquid-meniscus" aria-hidden="true" />
          {showBubbles &&
            activeBubbles.map((bubble, idx) => {
              // Distribute bubbles proportionally across the fluid width (between 10% and 88%)
              const leftPct = Math.round(10 + (idx / Math.max(bubbleCount - 1, 1)) * 78)
              return (
                <span
                  key={`${leftPct}-${bubble.size}-${idx}`}
                  className="hf-liquid-bubble"
                  aria-hidden="true"
                  style={{
                    left: `${leftPct}%`,
                    width: `${bubble.size}px`,
                    height: `${bubble.size}px`,
                    animationDuration: `${bubble.duration}s`,
                    animationDelay: `${bubble.delay}s`,
                    ['--hf-bubble-drift' as string]: `${bubble.drift}px`,
                  }}
                />
              )
            })}
        </div>
      )}
    </div>
  )
}
