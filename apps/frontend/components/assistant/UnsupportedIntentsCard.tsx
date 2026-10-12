'use client';

import type { UnsupportedIntent } from '@/services/assistant.service';

/**
 * Surfaces captured unsupported-intent events to the team (overhaul Duty 2,
 * Phase E). These are requests the assistant could not fulfil yet; they drive
 * the tool backlog. Owners/managers only.
 */
export function UnsupportedIntentsCard({
  intents,
}: {
  intents: UnsupportedIntent[];
}) {
  if (intents.length === 0) return null;

  return (
    <details
      data-testid="unsupported-intents"
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4"
    >
      <summary className="cursor-pointer text-sm font-bold text-[var(--color-text-primary)]">
        Unsupported requests ({intents.length})
      </summary>
      <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
        Requests the assistant could not do yet. Review them to decide which
        tools to add next.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {intents.slice(0, 10).map((intent) => (
          <li
            key={intent.id}
            className="flex items-start justify-between gap-3 text-xs text-[var(--color-text-primary)]"
          >
            <span className="min-w-0 truncate">{intent.intent}</span>
            <time
              dateTime={intent.createdAt}
              className="shrink-0 text-[var(--color-text-muted)]"
            >
              {new Date(intent.createdAt).toLocaleDateString('en-KE')}
            </time>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default UnsupportedIntentsCard;
