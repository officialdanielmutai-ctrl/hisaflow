import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface AnnouncementBadgeProps {
  chip: string;
  text: string;
  href: string;
}

/** Small status pill above the hero headline (Section 4.4). */
export function AnnouncementBadge({ chip, text, href }: AnnouncementBadgeProps) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center gap-2.5 rounded-[var(--mk-r-pill)] border border-[var(--mk-line)] bg-[var(--mk-surface)] pl-1.5 pr-4 shadow-[var(--mk-e1)] outline-none transition-colors hover:border-[var(--mk-ink-3)] focus-visible:ring-2 focus-visible:ring-[var(--mk-accent)] focus-visible:ring-offset-2"
    >
      <span className="rounded-[var(--mk-r-pill)] bg-[var(--mk-ink)] px-4 py-2 text-[11px] font-semibold text-white">
        {chip}
      </span>
      <span className="mk-small font-medium text-[var(--mk-ink-2)]">{text}</span>
      <ChevronRight
        aria-hidden="true"
        className="h-4 w-4 text-[var(--mk-ink-3)]"
        strokeWidth={1.5}
      />
    </Link>
  );
}
