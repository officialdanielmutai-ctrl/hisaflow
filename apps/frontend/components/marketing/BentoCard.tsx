import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type BentoCardTone =
  | 'surface'
  | 'accent'
  | 'ink'
  | 'outline'
  | 'tinted'
  | 'blue';

interface BentoCardProps {
  tone?: BentoCardTone;
  children: ReactNode;
  /** Optional media/visual area rendered above the content. */
  media?: ReactNode;
  className?: string;
}

const TONE_CLASSES: Record<BentoCardTone, string> = {
  surface: 'bg-[var(--mk-surface)] text-[var(--mk-ink)]',
  accent: 'bg-[var(--mk-accent)] text-[var(--mk-accent-ink)]',
  ink: 'bg-[var(--mk-ink)] text-white',
  outline:
    'border border-[var(--mk-line)] bg-transparent text-[var(--mk-ink)]',
  tinted: 'bg-[var(--color-bg-elevated)] text-[var(--mk-ink)]',
  blue: 'bg-[var(--color-accent-blue)] text-white',
};

/** A bento tile. Tiles differ in span/tone, never in alignment (Section 4.10). */
export function BentoCard({
  tone = 'surface',
  children,
  media,
  className,
}: BentoCardProps) {
  return (
    <article
      className={cn(
        'flex flex-col overflow-hidden rounded-[var(--mk-r-card)]',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {media ? <div className="relative">{media}</div> : null}
      <div className="flex flex-1 flex-col p-5 md:p-6">{children}</div>
    </article>
  );
}
