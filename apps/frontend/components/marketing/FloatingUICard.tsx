import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TagPill } from './TagPill';

interface FloatingUICardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  tags?: readonly string[];
  className?: string;
}

/** Real UI / concise-content card floating beside the device (Section 4.14). */
export function FloatingUICard({
  title,
  description,
  icon,
  tags,
  className,
}: FloatingUICardProps) {
  return (
    <div
      className={cn(
        'w-[280px] rounded-[var(--mk-r-card)] bg-[var(--mk-surface)] p-5 shadow-[var(--mk-e2)]',
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="mb-3 flex h-9 w-9 items-center justify-center rounded-[var(--mk-r-sm)] bg-[var(--color-bg-secondary)] text-[var(--mk-accent)]"
        >
          {icon}
        </span>
      ) : null}
      <h3 className="mk-h3 text-[var(--mk-ink)]">{title}</h3>
      {description ? (
        <p className="mk-small mt-1.5 text-[var(--mk-ink-2)]">{description}</p>
      ) : null}
      {tags && tags.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li key={tag}>
              <TagPill>{tag}</TagPill>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
