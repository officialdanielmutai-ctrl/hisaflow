import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EyebrowProps {
  children: ReactNode;
  tone?: 'light' | 'dark';
  className?: string;
  /** The section-2 reference allows an eyebrow without the leading dot. */
  dot?: boolean;
}

/** `• LABEL` micro-label (`hisaflow-landing-visual-spec.md` Section 4.3). */
export function Eyebrow({
  children,
  tone = 'light',
  className,
  dot = true,
}: EyebrowProps) {
  return (
    <span
      className={cn(
        'mk-eyebrow inline-flex items-center gap-2',
        tone === 'dark' ? 'text-white/60' : 'text-[var(--mk-ink-3)]',
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-[var(--mk-r-pill)] bg-[var(--mk-accent)]"
        />
      ) : null}
      {children}
    </span>
  );
}
