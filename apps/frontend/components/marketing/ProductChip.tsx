import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ProductChipProps {
  children?: ReactNode;
  /** Optional leading icon, sized in em so it scales with the headline. */
  icon?: ReactNode;
  className?: string;
}

/**
 * A small coded UI chip used inside a headline (Section 4.7). Decorative: it is
 * hidden from assistive technology so the headline reads as plain text.
 */
export function ProductChip({ children, icon, className }: ProductChipProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'mx-1 inline-flex h-[1.05em] translate-y-[0.08em] items-center gap-2 rounded-[var(--mk-r-pill)] border border-[var(--mk-line)] bg-[var(--mk-surface)] px-4 align-middle text-[0.5em] font-semibold text-[var(--mk-ink-2)] shadow-[var(--mk-e1)]',
        className,
      )}
    >
      {icon ? (
        <span className="inline-flex [&_svg]:h-[1em] [&_svg]:w-[1em]">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
