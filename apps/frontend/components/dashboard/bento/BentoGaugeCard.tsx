'use client'

import React, { useState, useRef, useEffect } from 'react'
import { MoreHorizontal, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DropdownOption } from './BentoStatisticsCard'

interface BentoGaugeCardProps {
  title?: string
  value?: number
  displayValue?: string
  label?: string
  totalCapacity?: number
  increasePct?: string
  footerText?: string
  className?: string
  onMenuClick?: () => void
  dropdownOptions?: DropdownOption[]
  selectedOptionId?: string
  onSelectOption?: (id: string) => void
}

export default function BentoGaugeCard({
  title = 'Customers Volume',
  value = 145,
  displayValue,
  label = 'New Customers',
  totalCapacity = 190,
  increasePct = '+ 25%',
  footerText = 'Your customer volume has increased',
  className,
  onMenuClick,
  dropdownOptions,
  selectedOptionId,
  onSelectOption,
}: BentoGaugeCardProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false)
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  // Generate 26 segmented arc ticks from 180 deg (left) to 0 deg (right)
  const totalTicks = 26
  const safeCapacity = Math.max(totalCapacity, 1)
  const activeTicksCount = Math.round(
    (Math.min(value, safeCapacity) / safeCapacity) * totalTicks
  )

  const cx = 100
  const cy = 95
  const rInner = 60
  const rOuter = 82

  const ticks = Array.from({ length: totalTicks }).map((_, i) => {
    const angleDeg = 180 - (i / (totalTicks - 1)) * 180
    const angleRad = (angleDeg * Math.PI) / 180

    const x1 = cx + rInner * Math.cos(angleRad)
    const y1 = cy - rInner * Math.sin(angleRad)
    const x2 = cx + rOuter * Math.cos(angleRad)
    const y2 = cy - rOuter * Math.sin(angleRad)

    const isActive = i < activeTicksCount
    const ratio = i / totalTicks
    let strokeColor = 'var(--color-border)'
    if (isActive) {
      if (ratio < 0.35) {
        strokeColor = 'var(--hf-chart-6)'
      } else if (ratio < 0.7) {
        strokeColor = 'var(--hf-chart-1)'
      } else {
        strokeColor = 'var(--hf-chart-2)'
      }
    }

    return { id: i, x1, y1, x2, y2, isActive, strokeColor }
  })

  const selectedOption =
    dropdownOptions?.find((o) => o.id === selectedOptionId) ??
    dropdownOptions?.[0]

  return (
    <div
      className={cn(
        'relative rounded-3xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] p-6 shadow-sm flex flex-col justify-between transition-all hover:border-[var(--color-accent)]',
        className
      )}
    >
      {/* ── Header Row ── */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-bold text-[var(--color-text-primary)]">
          {title}
        </h3>

        {dropdownOptions && dropdownOptions.length > 0 ? (
          <div className="relative inline-block text-left" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors max-w-[140px]',
                isDropdownOpen &&
                  'border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/30'
              )}
            >
              <span className="truncate">
                {selectedOption?.label ?? 'Select'}
              </span>
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 text-[var(--color-text-muted)] shrink-0 transition-transform',
                  isDropdownOpen && 'rotate-180'
                )}
              />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 max-h-60 overflow-y-auto no-scrollbar rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] shadow-xl z-50 p-1 flex flex-col gap-0.5 animate-in fade-in-0 zoom-in-95 duration-100">
                {dropdownOptions.map((opt) => {
                  const isSelected =
                    opt.id === (selectedOptionId ?? dropdownOptions[0]?.id)
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        onSelectOption?.(opt.id)
                        setIsDropdownOpen(false)
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors text-left',
                        isSelected
                          ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-bold'
                          : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]'
                      )}
                    >
                      <span className="truncate">{opt.label}</span>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {opt.badge && (
                          <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.2 text-[9px] font-bold">
                            {opt.badge}
                          </span>
                        )}
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={onMenuClick}
            className="p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label="Gauge options"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Segmented Radial Arch Gauge Canvas ── */}
      <div className="relative flex flex-col items-center justify-center my-1 group/gauge">
        <svg
          viewBox="0 0 200 115"
          className="w-full max-w-[240px] h-auto overflow-visible select-none transition-transform duration-300 group-hover/gauge:scale-105"
        >
          {ticks.map((tick) => (
            <line
              key={tick.id}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke={
                tick.isActive ? tick.strokeColor : 'var(--color-bg-elevated)'
              }
              strokeWidth="4"
              strokeLinecap="round"
              className={cn(
                'transition-all duration-500 ease-out',
                tick.isActive && 'animate-gauge-pulse',
                !tick.isActive && 'opacity-40'
              )}
            />
          ))}
        </svg>

        {/* Center Metric Callout */}
        <div className="absolute bottom-2 text-center pointer-events-none transition-transform duration-300 group-hover/gauge:scale-105">
          <p className="text-3xl sm:text-4xl font-black text-[var(--color-text-primary)] tracking-tight tabular-nums">
            {displayValue ?? value}
          </p>
          <p className="text-xs font-semibold text-[var(--color-text-secondary)] mt-0.5">
            {label}
          </p>
        </div>
      </div>

      {/* ── Footer Caption Row ── */}
      <div className="mt-3 pt-3 border-t border-[var(--color-border)]/60 flex items-center justify-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
        <span>{footerText}</span>
        <span className="inline-flex items-center rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/25 px-2 py-0.5 text-xs font-bold shrink-0">
          {increasePct}
        </span>
      </div>
    </div>
  )
}
