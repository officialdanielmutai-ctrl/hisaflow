import { Check, Sparkles } from 'lucide-react';
import { HERO_AI } from '@/features/marketing/config/content';
import { cn } from '@/lib/utils';

/** Right-hand hero card describing how HisaFlow AI ingests and tracks data. */
export function HeroAiCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-[var(--mk-r-card)] bg-[var(--mk-surface)] p-5 shadow-[var(--mk-e2)]',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-9 w-9 items-center justify-center rounded-[var(--mk-r-sm)] bg-[var(--color-bg-secondary)] text-[var(--mk-accent)]"
      >
        <Sparkles className="h-5 w-5" strokeWidth={1.5} />
      </span>
      <h3 className="mk-h3 mt-3 text-[19px] text-[var(--mk-ink)]">
        {HERO_AI.title}
      </h3>
      <p className="mk-small mt-2 text-[var(--mk-ink-2)]">
        {HERO_AI.description}
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {HERO_AI.points.map((point) => (
          <li
            key={point}
            className="flex items-start gap-2 text-[13px] leading-snug text-[var(--mk-ink-2)]"
          >
            <Check
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--mk-accent)]"
              strokeWidth={2}
            />
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}
