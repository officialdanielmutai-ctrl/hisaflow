'use client';

import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BentoGaugeCardProps {
  title?: string;
  value?: number;
  label?: string;
  totalCapacity?: number;
  increasePct?: string;
  footerText?: string;
  className?: string;
  onMenuClick?: () => void;
}

export default function BentoGaugeCard({
  title = 'Customers Volume',
  value = 145,
  label = 'New Customers',
  totalCapacity = 190,
  increasePct = '+ 25%',
  footerText = 'Your customer volume has increased',
  className,
  onMenuClick,
}: BentoGaugeCardProps) {
  // Generate 26 segmented arc ticks from 180 deg (left) to 0 deg (right)
  const totalTicks = 26;
  const activeTicksCount = Math.round((Math.min(value, totalCapacity) / totalCapacity) * totalTicks);

  const cx = 100;
  const cy = 95;
  const rInner = 60;
  const rOuter = 82;

  const ticks = Array.from({ length: totalTicks }).map((_, i) => {
    // angle from 180 down to 0
    const angleDeg = 180 - (i / (totalTicks - 1)) * 180;
    const angleRad = (angleDeg * Math.PI) / 180;

    const x1 = cx + rInner * Math.cos(angleRad);
    const y1 = cy - rInner * Math.sin(angleRad);
    const x2 = cx + rOuter * Math.cos(angleRad);
    const y2 = cy - rOuter * Math.sin(angleRad);

    const isActive = i < activeTicksCount;
    // Color progression from cyan (left) to emerald (right)
    const ratio = i / totalTicks;
    let strokeColor = 'var(--color-border)';
    if (isActive) {
      if (ratio < 0.35) {
        strokeColor = '#06b6d4'; // Cyan
      } else if (ratio < 0.7) {
        strokeColor = '#14b8a6'; // Teal
      } else {
        strokeColor = '#10b981'; // Emerald
      }
    }

    return { id: i, x1, y1, x2, y2, isActive, strokeColor };
  });

  return (
    <div
      className={cn(
        'relative rounded-3xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] p-6 shadow-sm flex flex-col justify-between transition-all hover:border-[var(--color-accent)]',
        className,
      )}
    >
      {/* ── Header Row ── */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-bold text-[var(--color-text-primary)]">
          {title}
        </h3>
        <button
          type="button"
          onClick={onMenuClick}
          className="p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          aria-label="Gauge options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
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
              stroke={tick.isActive ? tick.strokeColor : 'var(--color-bg-elevated)'}
              strokeWidth="4"
              strokeLinecap="round"
              className={cn(
                'transition-all duration-500 ease-out',
                tick.isActive && 'animate-gauge-pulse',
                !tick.isActive && 'opacity-40',
              )}
            />
          ))}
        </svg>

        {/* Center Metric Callout */}
        <div className="absolute bottom-2 text-center pointer-events-none transition-transform duration-300 group-hover/gauge:scale-105">
          <p className="text-3xl sm:text-4xl font-black text-[var(--color-text-primary)] tracking-tight tabular-nums">
            {value}
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
  );
}
