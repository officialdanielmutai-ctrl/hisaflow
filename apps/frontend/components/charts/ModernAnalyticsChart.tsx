'use client'

import React, { useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'
import { useDateRange } from '@/components/providers/DateRangeProvider'
import { TrendingUp, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DailyPerformancePoint {
  day: string
  sales: number
  expenses: number
  highlight?: boolean
}

function formatKES(val: number) {
  if (val >= 1000000) return `KES ${(val / 1000000).toFixed(1)}M`
  if (val >= 1000) return `KES ${(val / 1000).toFixed(0)}k`
  return `KES ${val}`
}

export default function ModernAnalyticsChart({
  data = [],
  className,
}: {
  data?: DailyPerformancePoint[]
  className?: string
}) {
  const { label: dateRangeLabel } = useDateRange()
  const [metric, setMetric] = useState<'sales' | 'expenses'>('sales')

  const hasData = data.length > 0 && data.some((d) => d[metric] > 0)

  const maxPoint = hasData
    ? data.reduce(
        (prev, current) => (current[metric] > prev[metric] ? current : prev),
        data[0]
      )
    : null

  /** Peak vs average delta — only shown when real data is present */
  const peakBadge = (() => {
    if (!hasData || !maxPoint) return null
    const avg = data.reduce((s, d) => s + d[metric], 0) / data.length
    if (avg === 0) return null
    const pct = Math.round(((maxPoint[metric] - avg) / avg) * 100)
    if (pct <= 0) return null
    return `+${pct}% peak`
  })()

  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 shadow-sm transition-all',
        className
      )}
    >
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">
              Performance Statistics
            </h3>
            {peakBadge && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                <TrendingUp className="h-3 w-3" />
                {peakBadge}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Active view: {dateRangeLabel}
          </p>
        </div>

        {/* Metric Switcher Pills */}
        <div className="flex items-center gap-1 rounded-xl bg-[var(--color-bg-elevated)] p-1">
          <button
            type="button"
            onClick={() => setMetric('sales')}
            className={cn(
              'rounded-lg px-3 py-1 text-xs font-semibold transition-all',
              metric === 'sales'
                ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            )}
          >
            Sales
          </button>
          <button
            type="button"
            onClick={() => setMetric('expenses')}
            className={cn(
              'rounded-lg px-3 py-1 text-xs font-semibold transition-all',
              metric === 'expenses'
                ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            )}
          >
            Expenses
          </button>
        </div>
      </div>

      {/* Chart Canvas — honest empty state when no real data */}
      <div className="h-64 w-full">
        {!hasData ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-[var(--color-text-muted)]">
            <ArrowUpRight className="h-8 w-8 opacity-30" />
            <p className="text-xs font-medium">No activity recorded yet</p>
            <p className="text-[11px] opacity-60">Data will appear here once transactions are logged</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 20, right: 10, left: -15, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--color-border)"
                strokeOpacity={0.6}
              />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                tickFormatter={(v) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
                }
              />
              <Tooltip
                cursor={{ fill: 'var(--color-bg-elevated)', opacity: 0.5 }}
                formatter={(value: any) => [
                  formatKES(Number(value)),
                  metric === 'sales' ? 'Sales' : 'Expenses',
                ]}
                contentStyle={{
                  borderRadius: 'var(--hf-radius-md)',
                  border: 'var(--hf-border-width) solid var(--hf-border-subtle)',
                  background: 'var(--hf-bg-surface)',
                  color: 'var(--hf-text-primary)',
                  fontSize: 12,
                  boxShadow: 'var(--hf-shadow-raised)',
                }}
              />
              <Bar dataKey={metric} radius={[8, 8, 0, 0]} animationDuration={800}>
                {data.map((entry, index) => {
                  const isPeak = maxPoint && entry.day === maxPoint.day
                  const fill = isPeak
                    ? metric === 'sales'
                      ? 'var(--hf-chart-1)'
                      : 'var(--hf-chart-4)'
                    : metric === 'sales'
                      ? 'var(--hf-chart-2)'
                      : 'var(--hf-chart-7)'
                  return <Cell key={`cell-${index}`} fill={fill} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
