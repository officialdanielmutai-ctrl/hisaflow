import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TagPillProps {
  children: ReactNode;
  tone?: 'light' | 'dark' | 'accent' | 'warm' | 'onAccent';
  icon?: ReactNode;
  className?: string;
}

/** Category/tag chip (`hisaflow-landing-visual-spec.md` Section 4.5). */
export function TagPill({ children, tone = 'light', icon, className }: TagPillProps) {
  return (
    <span
      className={cn(
        'mk-small inline-flex h-8 items-center gap-2 rounded-[var(--mk-r-pill)] px-3 font-medium',
        tone === 'dark' &&
          'border border-[var(--mk-line-dark)] text-white/80',
        tone === 'accent' &&
          'bg-[var(--mk-accent)] text-[var(--mk-accent-ink)]',
        tone === 'warm' &&
          'bg-[rgba(255,90,31,0.12)] text-[var(--mk-accent-warm-ink)]',
        tone === 'onAccent' && 'bg-black/20 text-white',
        tone === 'light' &&
          'border border-[var(--mk-line)] text-[var(--mk-ink-2)]',
        className,
      )}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
