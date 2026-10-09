import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionProps {
  id?: string;
  children: ReactNode;
  tone?: 'light' | 'ink' | 'tinted' | 'hero';
  className?: string;
  innerClassName?: string;
  /** Wraps the content in a centred max-width column while the card background
   *  stays full-bleed (used by the section-2 sections). */
  contentClassName?: string;
  /** Removes the default surface background (e.g. hero provides its own). */
  bare?: boolean;
  /** Semantic element to render; defaults to `section`. */
  as?: 'section' | 'footer' | 'header' | 'div';
}

/**
 * An inset rounded container on the canvas (`hisaflow-landing-visual-spec.md`
 * Section 5.1). Sections are cards, not full-bleed bands.
 */
export function Section({
  id,
  children,
  tone = 'light',
  className,
  innerClassName,
  contentClassName,
  bare = false,
  as = 'section',
}: SectionProps) {
  const Tag = as as ElementType;
  const content = contentClassName ? (
    <div className={contentClassName}>{children}</div>
  ) : (
    children
  );
  return (
    <Tag id={id} className={cn('mk-shell', className)}>
      <div
        className={cn(
          'mk-section',
          !bare && 'bg-[var(--mk-surface)]',
          tone === 'ink' && 'bg-[var(--mk-ink)] text-white',
          tone === 'tinted' && 'bg-[var(--color-bg-elevated)]',
          innerClassName,
        )}
      >
        {content}
      </div>
    </Tag>
  );
}
