import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';

function RowShell({
  icon: Icon,
  iconClassName,
  title,
  description,
  trailing,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  description?: string;
  trailing?: ReactNode;
}) {
  return (
    <>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconClassName ?? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]'}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]">
          {title}
        </span>
        {description && (
          <span className="mt-0.5 block text-xs leading-snug text-[var(--color-text-secondary)]">
            {description}
          </span>
        )}
      </span>
      {trailing}
    </>
  );
}

export function SettingsLinkRow({
  href,
  icon,
  iconClassName,
  title,
  description,
}: {
  href: string;
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  description?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--color-bg-elevated)]"
    >
      <RowShell
        icon={icon}
        iconClassName={iconClassName}
        title={title}
        description={description}
        trailing={<ChevronRight className="h-5 w-5 shrink-0 text-[var(--color-text-muted)]" />}
      />
    </Link>
  );
}

export function SettingsActionRow({
  icon,
  iconClassName,
  title,
  description,
  trailing,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  description?: string;
  trailing: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <RowShell
        icon={icon}
        iconClassName={iconClassName}
        title={title}
        description={description}
        trailing={trailing}
      />
    </div>
  );
}
