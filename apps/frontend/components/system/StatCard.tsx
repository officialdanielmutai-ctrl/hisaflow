import Link from 'next/link'
import React from 'react'
import {
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  Minus,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { LiquidProgress } from '@/components/system/LiquidProgress'

/**
 * Shared KPI/stat card (HisaFlow KPI Inspo Overhaul).
 *
 * Sizing, padding, alignment, tabular figures, truncation, slot layout,
 * dark theme compliance, and adversarial states (loading / empty / error).
 *
 * Supported Slots & Capabilities:
 * - Surface Variants: neutral, blue, emerald, amber, rose, and **hero** (deep dark midnight navy contrast)
 * - Temporal Delta Badge: explicit time-comparison indicator (e.g. "+ 22% vs last month")
 * - Micro-Visualizations: Area Spline Sparklines, Semi-Radial Arc Gauges, Segmented Velocity Bars
 * - In-card Quick Actions: Contextual trigger buttons (e.g. "Record Sale", "Check In")
 */
export type StatTone =
  | 'blue'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'neutral'
  | 'hero'
export type StatVariant = 'default' | 'compact'
export type StatState = 'default' | 'loading' | 'empty' | 'error'
export type StatEmphasis = 'default' | 'success' | 'warning' | 'critical'

export type StatTrailing =
  | { kind: 'arrow' }
  | { kind: 'menu'; onClick?: (e: React.MouseEvent) => void }
  | { kind: 'badge'; text: string; tone: StatTone }

export interface StatDelta {
  value: string // e.g. "+22%" or "-8%"
  period?: string // e.g. "vs last month"
  direction?: 'up' | 'down' | 'flat'
  tone?: 'success' | 'warning' | 'critical' | 'neutral'
}

export interface StatAction {
  label: string
  href?: string
  onClick?: (e: React.MouseEvent) => void
}

export interface StatCardContent {
  value: string
  sublabel?: string
  valueSuffix?: string
  fullValue?: string
  valueTone?: StatEmphasis
  footnote?: string
  footnoteTone?: StatEmphasis
  trailing?: StatTrailing
  delta?: StatDelta
  sparklineData?: number[]
  gauge?: { value: number; max?: number; label?: string }
  progress?: {
    value: number
    max?: number
    label?: string
    targetLabel?: string
  }
  action?: StatAction
}

/** One card in a vertical's arrangement. */
export interface StatCardConfig<TData = unknown> {
  id: string
  label: string
  icon: LucideIcon
  iconTone?: StatTone
  cardTone?: StatTone
  variant?: StatVariant
  href?: string
  /** Grid span at `sm` and up; the row grid is 2 columns on mobile, up to 4 on desktop. */
  span?: 1 | 2
  build: (data: TData) => StatCardContent
}

export interface StatCardProps extends StatCardContent {
  label: string
  sublabel?: string
  icon: LucideIcon
  iconTone?: StatTone
  cardTone?: StatTone
  variant?: StatVariant
  href?: string
  state?: StatState
  stateMessage?: string
  className?: string
}

const ICON_TONES: Record<StatTone, string> = {
  hero: 'bg-[var(--hf-accent-hover)] text-[var(--hf-accent-foreground)] border border-[var(--hf-accent-foreground)]',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  emerald:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  neutral: 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]',
}

const CARD_TONES: Record<StatTone, string> = {
  hero: 'border-[var(--hf-accent-hover)] bg-[var(--hf-accent-default)] text-[var(--hf-accent-foreground)] shadow-md hover:border-[var(--hf-border-strong)]',
  blue: 'border-blue-200/80 bg-gradient-to-br from-blue-50/40 via-[var(--color-bg-surface)] to-[var(--color-bg-surface)] hover:border-blue-400 dark:border-blue-900/50',
  emerald:
    'border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 via-[var(--color-bg-surface)] to-[var(--color-bg-surface)] hover:border-emerald-400 dark:border-emerald-900/50',
  amber:
    'border-amber-200/80 bg-gradient-to-br from-amber-50/40 via-[var(--color-bg-surface)] to-[var(--color-bg-surface)] hover:border-amber-400 dark:border-amber-900/50',
  rose: 'border-rose-200/80 bg-gradient-to-br from-rose-50/40 via-[var(--color-bg-surface)] to-[var(--color-bg-surface)] hover:border-rose-400 dark:border-rose-900/50',
  neutral:
    'border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:border-[var(--color-accent)]',
}

const VALUE_TONES: Record<StatEmphasis, string> = {
  default: 'text-[var(--color-text-primary)]',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  critical: 'text-[var(--color-status-critical)]',
}

const FOOTNOTE_TONES: Record<StatEmphasis, string> = {
  default: 'text-[var(--color-text-secondary)]',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  critical: 'text-[var(--color-status-critical)]',
}

const BADGE_TONES: Record<StatTone, string> = {
  hero: 'bg-[var(--hf-accent-hover)] text-[var(--hf-accent-foreground)] border border-[var(--hf-accent-foreground)]',
  blue: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
  emerald:
    'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  amber:
    'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  rose: 'bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
  neutral:
    'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border)]',
}

function TrailingSlot({
  trailing,
  tone,
}: {
  trailing?: StatTrailing
  tone: StatTone
}) {
  if (!trailing) return null
  const isHero = tone === 'hero'
  if (trailing.kind === 'menu') {
    return (
      <button
        type="button"
        onClick={trailing.onClick}
        aria-label="Options"
        className="p-1 rounded-lg text-[var(--hf-accent-foreground)] opacity-75 hover:opacity-100 transition-opacity"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
    )
  }
  if (trailing.kind === 'badge') {
    return (
      <span
        className={cn(
          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold border transition-all',
          isHero
            ? 'bg-[var(--hf-accent-hover)] text-[var(--hf-accent-foreground)] border-[var(--hf-accent-foreground)]'
            : BADGE_TONES[trailing.tone]
        )}
      >
        {trailing.text}
      </span>
    )
  }
  // kind === 'arrow' deliberately renders nothing to eliminate non-functional arrows
  return null
}

function DeltaBadge({ delta, isHero }: { delta: StatDelta; isHero?: boolean }) {
  const isUp = delta.direction === 'up' || delta.value.startsWith('+')
  const isDown = delta.direction === 'down' || delta.value.startsWith('-')
  const tone =
    delta.tone ?? (isUp ? 'success' : isDown ? 'critical' : 'neutral')

  const toneClasses = isHero
    ? 'bg-[var(--hf-accent-hover)] text-[var(--hf-accent-foreground)] border-[var(--hf-accent-foreground)]'
    : tone === 'success'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50'
      : tone === 'critical'
        ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50'
        : tone === 'warning'
          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50'
          : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border)]'

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold border transition-colors shrink-0',
          toneClasses
        )}
      >
        {isUp ? (
          <TrendingUp className="h-3 w-3" />
        ) : isDown ? (
          <TrendingDown className="h-3 w-3" />
        ) : (
          <Minus className="h-3 w-3" />
        )}
        <span>{delta.value}</span>
      </span>
      {delta.period && (
        <span
          className={cn(
            'text-xs font-normal',
            isHero
              ? 'text-[var(--hf-accent-foreground)] opacity-75'
              : 'text-[var(--color-text-secondary)]'
          )}
        >
          {delta.period}
        </span>
      )}
    </div>
  )
}

/**
 * Monotone cubic interpolation — the same shape-preserving curve used by
 * finance dashboards. It gives the sparkline a natural, confident curve
 * without the overshoot a plain Catmull-Rom spline introduces between noisy
 * data points.
 */
function buildFinancePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) {
    return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`
  }

  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < points.length - 1; i++) {
    dx[i] = points[i + 1].x - points[i].x
    slope[i] = (points[i + 1].y - points[i].y) / dx[i]
  }

  const tangent = new Array<number>(points.length)
  tangent[0] = slope[0]
  tangent[points.length - 1] = slope[slope.length - 1]

  for (let i = 1; i < points.length - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      tangent[i] = 0
      continue
    }
    const w1 = 2 * dx[i] + dx[i - 1]
    const w2 = dx[i] + 2 * dx[i - 1]
    tangent[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i])
  }

  // Fritsch–Carlson limiter: keep every segment monotone, so the trace never
  // dips below or rises above the real data points.
  for (let i = 0; i < points.length - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0
      tangent[i + 1] = 0
      continue
    }
    const a = tangent[i] / slope[i]
    const b = tangent[i + 1] / slope[i]
    const magnitude = Math.hypot(a, b)
    if (magnitude > 3) {
      tangent[i] = (3 * slope[i] * a) / magnitude
      tangent[i + 1] = (3 * slope[i] * b) / magnitude
    }
  }

  let path = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i]
    const next = points[i + 1]
    const third = dx[i] / 3
    const cp1x = curr.x + third
    const cp1y = curr.y + tangent[i] * third
    const cp2x = next.x - third
    const cp2y = next.y - tangent[i + 1] * third
    path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${next.x.toFixed(1)},${next.y.toFixed(1)}`
  }
  return path
}

function StatSparkline({ data, isHero }: { data: number[]; isHero?: boolean }) {
  if (!data || data.length < 2) return null

  const width = 180
  const height = 58
  const padTop = 7
  const padBottom = 9
  const baselineY = height - padBottom
  const plotHeight = baselineY - padTop

  const values = data.map((value) =>
    Number.isFinite(value) ? Number(value) : 0
  )
  const min = Math.min(...values)
  const max = Math.max(...values)
  const isFlat = min === 0 && max === 0
  const domainMin = Math.min(0, min)
  const domainMax = Math.max(max, domainMin + 1)
  const domainRange = domainMax - domainMin || 1

  const points = values.map((value, index) => ({
    x: (index / (values.length - 1)) * width,
    y: isFlat
      ? baselineY
      : baselineY - ((value - domainMin) / domainRange) * plotHeight,
  }))

  const linePath = buildFinancePath(points)
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`
  const latest = points[points.length - 1]
  const strokeColor = isHero ? 'var(--hf-chart-2)' : 'var(--hf-chart-1)'
  const gridColor = isHero
    ? 'rgba(255, 255, 255, 0.14)'
    : 'var(--color-border)'
  const zeroY = baselineY - ((0 - domainMin) / domainRange) * plotHeight

  const idSeed = `${values.length}-${Math.round(Math.abs(min))}-${Math.round(
    Math.abs(max)
  )}-${Math.round(Math.abs(values.reduce((a, b) => a + b, 0)))}-${
    isHero ? 'hero' : 'surface'
  }`
  const areaGradId = `spark-area-${idSeed}`
  const lineGradId = `spark-line-${idSeed}`
  const glowGradId = `spark-glow-${idSeed}`
  const glowY = Math.min(height - 0.5, latest.y + 5)

  return (
    <div className="w-full h-14 my-1.5 group/spark relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full overflow-visible transition-all duration-300 group-hover/spark:drop-shadow-[0_6px_14px_rgba(16,185,129,0.24)]"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={areaGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.34} />
            <stop offset="58%" stopColor={strokeColor} stopOpacity={0.1} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0.01} />
          </linearGradient>
          <linearGradient id={lineGradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.58} />
            <stop offset="58%" stopColor={strokeColor} stopOpacity={1} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0.88} />
          </linearGradient>
          <radialGradient id={glowGradId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.72} />
            <stop offset="45%" stopColor={strokeColor} stopOpacity={0.34} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
          </radialGradient>
        </defs>

        {/* Recessed chart grid — depth cue, not decoration */}
        {[0.25, 0.5, 0.75].map((offset) => {
          const y = padTop + plotHeight * offset
          return (
            <line
              key={offset}
              x1="0"
              y1={y.toFixed(1)}
              x2={width}
              y2={y.toFixed(1)}
              stroke={gridColor}
              strokeWidth="1"
              strokeDasharray="2 5"
              opacity={isHero ? 0.9 : 0.62}
              vectorEffect="non-scaling-stroke"
              className="hf-spark-grid"
            />
          )
        })}
        {domainMin < 0 && (
          <line
            x1="0"
            y1={zeroY.toFixed(1)}
            x2={width}
            y2={zeroY.toFixed(1)}
            stroke={gridColor}
            strokeWidth="1"
            strokeDasharray="3 4"
            opacity="0.8"
            vectorEffect="non-scaling-stroke"
            className="hf-spark-grid"
          />
        )}

        {/* Soft area volume */}
        <path
          d={areaPath}
          fill={`url(#${areaGradId})`}
          className="hf-spark-area"
        />

        {/* Soft luminous bloom behind the ribbon */}
        <path
          d={linePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth="6.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.08"
          pathLength="100"
          vectorEffect="non-scaling-stroke"
          className="hf-spark-trace-line"
        />

        {/* Extruded base + main stroke + top highlight = 3D line ribbon */}
        <path
          d={linePath}
          transform="translate(0 1.8)"
          fill="none"
          stroke={strokeColor}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.18"
          pathLength="100"
          vectorEffect="non-scaling-stroke"
          className="hf-spark-trace-line"
        />
        <path
          d={linePath}
          fill="none"
          stroke={`url(#${lineGradId})`}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength="100"
          vectorEffect="non-scaling-stroke"
          className="hf-spark-trace-line"
        />
        <path
          d={linePath}
          transform="translate(0 -0.65)"
          fill="none"
          stroke={isHero ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.72)'}
          strokeWidth="0.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength="100"
          vectorEffect="non-scaling-stroke"
          className="hf-spark-trace-line hf-spark-highlight"
        />

        {/* Terminal guide + soft light pooling underneath the final point */}
        <line
          x1={latest.x.toFixed(1)}
          y1={padTop}
          x2={latest.x.toFixed(1)}
          y2={Math.max(padTop, latest.y - 3).toFixed(1)}
          stroke={strokeColor}
          strokeWidth="1"
          strokeDasharray="2 3"
          opacity="0.28"
          vectorEffect="non-scaling-stroke"
          className="hf-terminal-guide"
        />
        <ellipse
          cx={latest.x.toFixed(1)}
          cy={glowY.toFixed(1)}
          rx="17"
          ry="6"
          fill={`url(#${glowGradId})`}
          className="hf-terminal-glow"
        />
        <circle
          cx={latest.x.toFixed(1)}
          cy={latest.y.toFixed(1)}
          r="6.8"
          fill={strokeColor}
          opacity="0.16"
          className="hf-terminal-halo"
        />
        <circle
          cx={latest.x.toFixed(1)}
          cy={latest.y.toFixed(1)}
          r="4.6"
          fill="none"
          stroke={strokeColor}
          strokeWidth="1"
          opacity="0.34"
        />
        <circle
          cx={latest.x.toFixed(1)}
          cy={latest.y.toFixed(1)}
          r="3.1"
          fill={strokeColor}
          className="hf-terminal-dot"
        />
        <circle
          cx={latest.x.toFixed(1)}
          cy={latest.y.toFixed(1)}
          r="1.1"
          fill="#ffffff"
          className="hf-terminal-core"
        />
      </svg>
    </div>
  )
}

function StatGauge({
  value,
  max = 100,
  label,
  isHero,
}: {
  value: number
  max?: number
  label?: string
  isHero?: boolean
}) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100)
  const totalTicks = 22
  const activeTicksCount = Math.round((pct / 100) * totalTicks)

  const cx = 60
  const cy = 54
  const rInner = 34
  const rOuter = 48

  const ticks = Array.from({ length: totalTicks }).map((_, i) => {
    const angleDeg = 180 - (i / (totalTicks - 1)) * 180
    const angleRad = (angleDeg * Math.PI) / 180
    const x1 = cx + rInner * Math.cos(angleRad)
    const y1 = cy - rInner * Math.sin(angleRad)
    const x2 = cx + rOuter * Math.cos(angleRad)
    const y2 = cy - rOuter * Math.sin(angleRad)

    const isActive = i < activeTicksCount
    const ratio = i / totalTicks
    let strokeColor = isHero
      ? 'var(--hf-accent-hover)'
      : 'var(--color-bg-elevated)'
    if (isActive) {
      if (ratio < 0.35) strokeColor = 'var(--hf-chart-6)'
      else if (ratio < 0.7) strokeColor = 'var(--hf-chart-1)'
      else strokeColor = 'var(--hf-chart-2)'
    }
    return { id: i, x1, y1, x2, y2, isActive, strokeColor }
  })

  return (
    <div className="relative flex flex-col items-center justify-center my-2 group/gauge">
      <svg
        viewBox="0 0 120 66"
        className="w-36 h-20 overflow-visible select-none transition-transform duration-300 group-hover/gauge:scale-105"
      >
        {ticks.map((tick) => (
          <line
            key={tick.id}
            x1={tick.x1.toFixed(1)}
            y1={tick.y1.toFixed(1)}
            x2={tick.x2.toFixed(1)}
            y2={tick.y2.toFixed(1)}
            stroke={tick.strokeColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            className={cn(
              'transition-all duration-500 ease-out',
              tick.isActive && 'animate-gauge-pulse',
              !tick.isActive && 'opacity-35'
            )}
          />
        ))}
      </svg>
      <div className="absolute bottom-0 text-center pointer-events-none transition-transform duration-300 group-hover/gauge:scale-105">
        <span
          className={cn(
            'text-sm font-black tracking-tight tabular-nums',
            isHero
              ? 'text-[var(--hf-accent-foreground)]'
              : 'text-[var(--color-text-primary)]'
          )}
        >
          {Math.round(pct)}%
        </span>
        {label && (
          <p
            className={cn(
              'text-[9px] font-semibold truncate',
              isHero
                ? 'text-[var(--hf-accent-foreground)] opacity-75'
                : 'text-[var(--color-text-muted)]'
            )}
          >
            {label}
          </p>
        )}
      </div>
    </div>
  )
}

function StatProgressBar({
  value,
  max = 100,
  label,
  targetLabel,
  isHero,
}: {
  value: number
  max?: number
  label?: string
  targetLabel?: string
  isHero?: boolean
}) {
  return (
    <div className="w-full my-2.5 flex flex-col gap-1.5 group/progress">
      <LiquidProgress
        value={value}
        max={max}
        isHero={isHero}
        ariaLabel={label ?? 'Progress'}
        className="group-hover/progress:shadow-md"
      />
      {(label || targetLabel) && (
        <div
          className={cn(
            'flex items-center justify-between text-[11px] font-medium',
            isHero
              ? 'text-[var(--hf-accent-foreground)] opacity-80'
              : 'text-[var(--color-text-secondary)]'
          )}
        >
          {label && <span>{label}</span>}
          {targetLabel && (
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {targetLabel}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function StatSkeleton({ compact }: { compact: boolean }) {
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-[var(--color-bg-elevated)]" />
          <div className="min-w-0">
            <span className="block w-24 truncate rounded bg-[var(--color-bg-elevated)] text-xs text-transparent">
              &nbsp;
            </span>
            <span className="block w-16 truncate rounded bg-[var(--color-bg-elevated)] text-[11px] text-transparent">
              &nbsp;
            </span>
          </div>
        </div>
      </div>
      <div className="my-1 min-w-0">
        <p
          className={cn(
            'w-28 truncate rounded bg-[var(--color-bg-elevated)] text-transparent',
            compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'
          )}
        >
          &nbsp;
        </p>
      </div>
      <p className="min-h-[18px] w-28 truncate rounded bg-[var(--color-bg-elevated)] text-xs text-transparent">
        &nbsp;
      </p>
    </>
  )
}

export function StatCard({
  label,
  sublabel,
  value,
  valueSuffix,
  fullValue,
  valueTone = 'default',
  footnote,
  footnoteTone = 'default',
  trailing,
  delta,
  sparklineData,
  gauge,
  progress,
  action,
  icon: Icon,
  iconTone,
  cardTone = 'neutral',
  variant = 'default',
  href,
  state = 'default',
  stateMessage,
  className,
}: StatCardProps) {
  const compact = variant === 'compact'
  const resolvedIconTone = iconTone ?? cardTone
  const isHero = cardTone === 'hero'

  if (state === 'loading') {
    return (
      <div
        data-testid="stat-card"
        data-stat-label={label}
        aria-hidden="true"
        className={cn(
          'flex h-full min-w-0 animate-pulse flex-col justify-between rounded-2xl border p-4 shadow-sm sm:p-5',
          CARD_TONES[cardTone],
          className
        )}
      >
        <StatSkeleton compact={compact} />
      </div>
    )
  }

  const isError = state === 'error'
  const isEmpty = state === 'empty'
  const displayValue = isError || isEmpty ? '—' : value
  const displayFootnote = isError
    ? (stateMessage ?? 'Could not load this metric.')
    : isEmpty
      ? (stateMessage ?? 'No data yet.')
      : footnote
  const hasFootnote = Boolean(displayFootnote)

  const body = (
    <>
      {/* Top Header Slot */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
              ICON_TONES[resolvedIconTone]
            )}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <span
              className={cn(
                'block truncate text-xs font-bold uppercase tracking-wider',
                isHero
                  ? 'text-[var(--hf-accent-foreground)] opacity-80'
                  : 'text-[var(--color-text-primary)]'
              )}
            >
              {label}
            </span>
            {sublabel ? (
              <span
                className={cn(
                  'block truncate text-[11px]',
                  isHero
                    ? 'text-[var(--hf-accent-foreground)] opacity-75'
                    : 'text-[var(--color-text-secondary)]'
                )}
              >
                {sublabel}
              </span>
            ) : null}
          </div>
        </div>
        <TrailingSlot trailing={trailing} tone={cardTone} />
      </div>

      {/* Main Metric Value */}
      <div className="my-1 min-w-0">
        <p
          data-stat-value
          title={fullValue}
          className={cn(
            'truncate font-black tracking-tight tabular-nums',
            isHero
              ? 'text-[var(--hf-accent-foreground)]'
              : VALUE_TONES[valueTone],
            compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'
          )}
        >
          {displayValue}
          {!isError && !isEmpty && valueSuffix ? (
            <span
              className={cn(
                'ml-1 text-base font-medium sm:text-lg',
                isHero
                  ? 'text-[var(--hf-accent-foreground)] opacity-75'
                  : 'text-[var(--color-text-secondary)]'
              )}
            >
              {valueSuffix}
            </span>
          ) : null}
        </p>
      </div>

      {/* Optional Micro-Visualizations */}
      {!isError && !isEmpty && gauge && (
        <StatGauge
          value={gauge.value}
          max={gauge.max}
          label={gauge.label}
          isHero={isHero}
        />
      )}
      {!isError && !isEmpty && sparklineData && sparklineData.length > 1 && (
        <StatSparkline data={sparklineData} isHero={isHero} />
      )}
      {!isError && !isEmpty && progress && (
        <StatProgressBar
          value={progress.value}
          max={progress.max}
          label={progress.label}
          targetLabel={progress.targetLabel}
          isHero={isHero}
        />
      )}

      {/* Footer / Delta / Action Row */}
      <div className="mt-2 flex items-center justify-between gap-2 min-h-[22px]">
        {delta && !isError && !isEmpty ? (
          <DeltaBadge delta={delta} isHero={isHero} />
        ) : hasFootnote ? (
          <p
            className={cn(
              'truncate text-xs',
              isHero
                ? 'text-[var(--hf-accent-foreground)] opacity-75'
                : isError
                  ? FOOTNOTE_TONES.critical
                  : FOOTNOTE_TONES[footnoteTone]
            )}
          >
            {displayFootnote}
          </p>
        ) : (
          <span />
        )}

        {action && (
          <Link
            href={action.href ?? '#'}
            onClick={action.onClick}
            className={cn(
              'shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full border transition-colors',
              isHero
                ? 'border-[var(--hf-accent-foreground)] text-[var(--hf-accent-foreground)] opacity-85 hover:opacity-100'
                : 'border-[var(--color-border)] text-[var(--color-accent)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-surface-hover)]'
            )}
          >
            {action.label}
          </Link>
        )}
      </div>
    </>
  )

  const classes = cn(
    'group flex h-full min-w-0 flex-col justify-between rounded-2xl border p-4 shadow-sm transition-all sm:p-5',
    CARD_TONES[cardTone],
    className
  )

  if (href) {
    return (
      <Link
        href={href}
        data-testid="stat-card"
        data-stat-label={label}
        className={classes}
      >
        {body}
      </Link>
    )
  }

  return (
    <div data-testid="stat-card" data-stat-label={label} className={classes}>
      {body}
    </div>
  )
}
