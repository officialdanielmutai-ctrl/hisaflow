'use client'

import React, { useState } from 'react'
import { MoreHorizontal, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LiquidProgress } from '@/components/system/LiquidProgress'

export type GrowthTimeframe = '24h' | '12h' | 'week' | 'month'

export interface GrowthData {
  count: string
  delta: string
  progressPct: number
  footerTotal: string
  footerAdd: string
}

interface BentoGrowthCardProps {
  title?: string
  className?: string
  onMenuClick?: () => void
  customData?: Partial<Record<GrowthTimeframe, GrowthData>>
  currentCount?: string
  currentDelta?: string
  currentProgressPct?: number
  footerLeftLabel?: string
  footerRightLabel?: string
  onTimeframeChange?: (timeframe: GrowthTimeframe) => void
}

export default function BentoGrowthCard({
  title = 'Growth Velocity',
  className,
  onMenuClick,
  customData,
  currentCount = '100%',
  currentDelta = '+12%',
  currentProgressPct = 75,
  footerLeftLabel = 'Operating velocity',
  footerRightLabel = 'Paced steadily',
  onTimeframeChange,
}: BentoGrowthCardProps) {
  const [selectedTimeframe, setSelectedTimeframe] =
    useState<GrowthTimeframe>('24h')

  const activeData: GrowthData = {
    count: customData?.[selectedTimeframe]?.count ?? currentCount,
    delta: customData?.[selectedTimeframe]?.delta ?? currentDelta,
    progressPct:
      customData?.[selectedTimeframe]?.progressPct ?? currentProgressPct,
    footerTotal:
      customData?.[selectedTimeframe]?.footerTotal ?? footerLeftLabel,
    footerAdd: customData?.[selectedTimeframe]?.footerAdd ?? footerRightLabel,
  }

  const handleTimeframeClick = (tf: GrowthTimeframe) => {
    setSelectedTimeframe(tf)
    onTimeframeChange?.(tf)
  }

  return (
    <div
      className={cn(
        'relative rounded-3xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] p-6 shadow-sm flex flex-col justify-between transition-all hover:border-[var(--color-accent)]',
        className
      )}
    >
      {/* ── Header Row ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-[var(--color-text-primary)]">
            {title}
          </h3>
          <button
            type="button"
            onClick={onMenuClick}
            className="p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label="Growth options"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        {/* ── Embedded Timeframe Pill Switcher ── */}
        <div className="inline-flex items-center gap-1.5 p-1 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] mb-5">
          {(
            [
              { key: '24h', label: '24h' },
              { key: '12h', label: '12h' },
              { key: 'week', label: 'A Week' },
              { key: 'month', label: 'Month' },
            ] as const
          ).map((tab) => {
            const isActive = selectedTimeframe === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTimeframeClick(tab.key)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold transition-all',
                  isActive
                    ? 'bg-[var(--hf-accent-default)] text-[var(--hf-accent-foreground)] shadow-sm'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Metric & Delta Row ── */}
      <div className="my-2">
        <div className="flex items-center gap-3">
          <span className="text-3xl sm:text-4xl font-black text-[var(--color-text-primary)] tracking-tight tabular-nums">
            {activeData.count}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/25 px-2.5 py-0.5 text-xs font-bold">
            <TrendingUp className="h-3 w-3" />
            <span>{activeData.delta}</span>
          </span>
        </div>

        {/* ── Liquid-like Animated Progress Bar ── */}
        <div className="mt-4 mb-2 group/liquid relative">
          {/* Floating Hover Indicator Tooltip */}
          <div
            className="absolute -top-6 transition-all duration-300 opacity-0 group-hover/liquid:opacity-100 pointer-events-none transform -translate-x-1/2"
            style={{ left: `${activeData.progressPct}%` }}
          >
            <span className="rounded-full bg-[var(--hf-accent-default)] text-[var(--hf-accent-foreground)] px-2 py-0.5 text-[10px] font-black shadow-md border border-[var(--hf-accent-hover)]">
              {activeData.progressPct}%
            </span>
          </div>

          <LiquidProgress
            value={activeData.progressPct}
            ariaLabel={`${title} progress`}
            className="group-hover/liquid:shadow-md"
          />
        </div>
      </div>

      {/* ── Split Footer Stats ── */}
      <div className="mt-2 pt-2 border-t border-[var(--color-border)]/60 flex items-center justify-between text-xs">
        <span className="text-[var(--color-text-secondary)] font-medium">
          {activeData.footerTotal}
        </span>
        <span className="font-bold text-[var(--color-text-primary)]">
          {activeData.footerAdd}
        </span>
      </div>
    </div>
  )
}
