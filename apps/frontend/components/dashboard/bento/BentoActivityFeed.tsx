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
    name: 'Operating stream active',
    avatarText: '✓',
    avatarColor: 'bg-emerald-500',
    description: 'All point-of-sale and transaction channels active',
    time: 'Live',
    value: 'Ready',
    badgeText: 'Active',
    badgeTone: 'emerald',
  },
  {
    id: 'ord-2',
    name: 'Daily inventory ledger verified',
    avatarText: 'I',
    avatarColor: 'bg-teal-500',
    description: 'Stock deductions synchronized with recent sales',
    time: 'Recent',
    value: 'In Sync',
    badgeText: 'Verified',
    badgeTone: 'teal',
  },
  {
    id: 'ord-3',
    name: 'Audit telemetry operational',
    avatarText: 'A',
    avatarColor: 'bg-blue-500',
    description: 'Transaction logs and alerts monitored',
    time: 'Recent',
    value: 'Logged',
    badgeText: 'Secure',
    badgeTone: 'indigo',
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
  orders,
  className,
  onMenuClick,
}: BentoActivityFeedProps) {
  const displayOrders = orders && orders.length > 0 ? orders : DEFAULT_ORDERS;

  return (
    <div
      className={cn(
        'relative rounded-3xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] p-6 shadow-sm flex flex-col justify-between overflow-hidden transition-all hover:border-[var(--color-accent)]',
        className,
      )}
    >
      {/* Subtle ambient gradient backdrop */}
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

      {/* ── Orders List ── */}
      <div className="flex flex-col gap-3 z-10">
        {displayOrders.slice(0, 4).map((order) => (
          <div
            key={order.id}
            className="flex items-center justify-between gap-3 p-2 rounded-2xl transition-colors hover:bg-[var(--color-bg-elevated)]/60 group/item"
          >
            {/* Avatar + Main Details */}
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={cn(
                  'h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm transition-transform group-hover/item:scale-105',
                  order.avatarColor,
                )}
              >
                {order.avatarText}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                  {order.name}
                </p>
                <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
                  {order.description}
                </p>
              </div>
            </div>

            {/* Price Tag & Tone Capsule */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-[var(--color-text-primary)] tabular-nums">
                {order.value}
              </span>
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-tight',
                  BADGE_TONES[order.badgeTone] ?? BADGE_TONES.teal,
                )}
              >
                {order.badgeText}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
