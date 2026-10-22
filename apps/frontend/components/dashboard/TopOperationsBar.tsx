'use client';

import React from 'react';
import Link from 'next/link';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OperationShortcut {
  label: string;
  href?: string;
  onClick?: () => void;
  icon: LucideIcon;
  primary?: boolean;
  badge?: string | number;
}

interface TopOperationsBarProps {
  shortcuts: OperationShortcut[];
  className?: string;
}

export function TopOperationsBar({ shortcuts, className }: TopOperationsBarProps) {
  if (!shortcuts || shortcuts.length === 0) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1 select-none flex-wrap',
        className,
      )}
    >
      {shortcuts.map((shortcut, index) => {
        const Icon = shortcut.icon;
        const isPrimary = Boolean(shortcut.primary);

        const content = (
          <>
            <Icon
              className={cn(
                'h-3.5 w-3.5 shrink-0 transition-transform group-hover:scale-110',
                isPrimary ? 'text-white' : 'text-[var(--color-primary)] dark:text-emerald-400',
              )}
            />
            <span className="truncate">{shortcut.label}</span>
            {shortcut.badge != null && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.2 text-[10px] font-black',
                  isPrimary
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
                )}
              >
                {shortcut.badge}
              </span>
            )}
          </>
        );

        const baseStyles = cn(
          'group inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 shadow-sm active:scale-95',
          isPrimary
            ? 'bg-[var(--color-accent)] text-white hover:opacity-90 shadow-emerald-500/20'
            : 'bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-elevated)]',
        );

        if (shortcut.href) {
          return (
            <Link key={index} href={shortcut.href} className={baseStyles}>
              {content}
            </Link>
          );
        }

        return (
          <button
            key={index}
            type="button"
            onClick={shortcut.onClick}
            className={baseStyles}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
