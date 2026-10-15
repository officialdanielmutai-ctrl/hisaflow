import type { ReactNode } from 'react';

/**
 * Building blocks for the mobile admin-panel style Settings screen: grouped
 * cards with a section label, consistent spacing, and divider-separated rows.
 */
export function SettingsGroup({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      {title && (
        <div className="px-1">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{description}</p>
          )}
        </div>
      )}
      <div className="divide-y divide-[var(--color-border)] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
        {children}
      </div>
    </section>
  );
}

/** A hairline that lines up with the text column of a settings row. */
export function SettingsRowDivider() {
  return <div className="ml-14 h-px bg-[var(--color-border)]" aria-hidden />;
}
