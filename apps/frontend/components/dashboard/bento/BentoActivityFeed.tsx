'use client';

import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ActivityOrder {
  id: string;
  name: string;
  avatarText: string;
  avatarColor: string;
  description: string;
  time: string;
  value: string;
  badgeText: string;
  badgeTone: 'sky' | 'teal' | 'indigo' | 'emerald';
}

const DEFAULT_ORDERS: ActivityOrder[] = [
  {
    id: 'ord-1',
    name: 'Jenny placed a large total order',
    avatarText: 'J',
    avatarColor: 'bg-emerald-500',
    description: 'total order processed at 18:20',
    time: '18:20',
    value: 'KES 28,400',
    badgeText: 'San Francisco',
    badgeTone: 'sky',
  },
  {
    id: 'ord-2',
    name: 'Paul purchased items',
    avatarText: 'P',
    avatarColor: 'bg-amber-500',
    description: 'value order in KES 19,800',
    time: '17:45',
    value: 'KES 19,800',
    badgeText: 'Los Angeles',
    badgeTone: 'teal',
  },
  {
    id: 'ord-3',
    name: 'Mike made repeat order',
    avatarText: 'M',
    avatarColor: 'bg-blue-500',
    description: 'value order in KES 6,880',
    time: '16:15',
    value: 'KES 6,880',
    badgeText: 'San Diego',
    badgeTone: 'indigo',
  },
  {
    id: 'ord-4',
    name: 'Sarah completed order pickup',
    avatarText: 'S',
    avatarColor: 'bg-purple-500',
    description: 'in-store checkout verified',
    time: '15:30',
    value: 'KES 14,200',
    badgeText: 'Nairobi West',
    badgeTone: 'emerald',
  },
];

const BADGE_TONES = {
  sky: 'bg-sky-500 text-white shadow-sm',
  teal: 'bg-teal-500 text-white shadow-sm',
  indigo: 'bg-indigo-600 text-white shadow-sm',
  emerald: 'bg-emerald-600 text-white shadow-sm',
};

interface BentoActivityFeedProps {
  title?: string;
  orders?: ActivityOrder[];
  className?: string;
  onMenuClick?: () => void;
}

export default function BentoActivityFeed({
  title = 'Live Operations Stream',
  orders = DEFAULT_ORDERS,
  className,
  onMenuClick,
}: BentoActivityFeedProps) {
  return (
    <div
      className={cn(
        'relative rounded-3xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] p-6 shadow-sm flex flex-col justify-between overflow-hidden transition-all hover:border-[var(--color-accent)]',
        className,
      )}
    >
      {/* Subtle ambient gradient backdrop (matching the geographic map nuance from Inspo 1) */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-gradient-to-br from-cyan-400/10 via-teal-400/10 to-transparent blur-2xl" />

      {/* ── Header Row ── */}
      <div className="flex items-center justify-between mb-4 z-10">
        <h3 className="text-base font-bold text-[var(--color-text-primary)]">
          {title}
        </h3>
        <button
          type="button"
          onClick={onMenuClick}
          className="p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          aria-label="Order feed options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* ── Order Rows ── */}
      <div className="flex flex-col gap-3 z-10 flex-1 justify-center">
        {orders.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[var(--color-bg-elevated)]/60 border border-[var(--color-border)]/50 hover:bg-[var(--color-bg-elevated)] transition-colors"
          >
            {/* Left: Avatar + Details */}
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={cn(
                  'h-9 w-9 rounded-full text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm',
                  item.avatarColor,
                )}
              >
                {item.avatarText}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                  {item.name}
                </p>
                <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
                  {item.description}
                </p>
              </div>
            </div>

            {/* Right: Vibrant Location Capsule Pill */}
            <span
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-[11px] font-bold',
                BADGE_TONES[item.badgeTone],
              )}
            >
              {item.badgeText}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
