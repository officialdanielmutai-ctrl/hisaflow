'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';
import { useDateRange, type DateRangePreset } from '@/components/providers/DateRangeProvider';
import { cn } from '@/lib/utils';

const PRESETS: Array<{ id: DateRangePreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: 'month', label: 'This Month' },
  { id: 'year', label: 'This Year' },
];

export default function DateRangePicker({ className }: { className?: string }) {
  const { preset, label, setPreset } = useDateRange();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  return (
    <div ref={containerRef} className={cn('relative inline-block text-left', className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] shadow-sm hover:bg-[var(--color-bg-surface-hover)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Calendar className="h-3.5 w-3.5 text-[var(--color-accent)]" />
        <span className="truncate max-w-[140px]">{label}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-[var(--color-text-muted)] transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-2 z-50 w-44 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-1.5 shadow-lg focus:outline-none animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            Select Timeframe
          </div>
          <div className="flex flex-col gap-0.5">
            {PRESETS.map((p) => {
              const isSelected = preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setPreset(p.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex items-center justify-between w-full rounded-lg px-2.5 py-1.5 text-xs font-medium text-left transition-colors',
                    isSelected
                      ? 'bg-[var(--color-bg-secondary)] text-[var(--color-accent)] font-bold'
                      : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)]',
                  )}
                >
                  <span>{p.label}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-[var(--color-accent)]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
