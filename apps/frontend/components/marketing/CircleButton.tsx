'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type CircleButtonVariant = 'outline' | 'ink' | 'accent';
type CircleButtonSize = 'md' | 'lg';

interface CircleButtonProps {
  children: ReactNode;
  /** Accessible name. Required because the button is icon-only. */
  label: string;
  variant?: CircleButtonVariant;
  size?: CircleButtonSize;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

const VARIANT_CLASSES: Record<CircleButtonVariant, string> = {
  outline:
    'border border-[var(--mk-line)] bg-[var(--mk-surface)] text-[var(--mk-ink)] hover:border-[var(--mk-ink-3)]',
  ink: 'bg-[var(--mk-ink)] text-white hover:opacity-90',
  accent:
    'bg-[var(--mk-accent)] text-[var(--mk-accent-ink)] hover:bg-[var(--mk-accent-hover)]',
};

const SIZE_CLASSES: Record<CircleButtonSize, string> = {
  md: 'h-11 w-11',
  lg: 'h-16 w-16',
};

/** Touch-safe circular icon button (`hisaflow-landing-visual-spec.md` 4.6). */
export function CircleButton({
  children,
  label,
  variant = 'outline',
  size = 'md',
  href,
  onClick,
  disabled = false,
  className,
}: CircleButtonProps) {
  const classes = cn(
    'inline-flex shrink-0 items-center justify-center rounded-[var(--mk-r-pill)] transition-[background-color,border-color,transform] duration-[var(--mk-dur-fast)] ease-[var(--mk-ease)] hover:scale-[1.04] outline-none focus-visible:ring-2 focus-visible:ring-[var(--mk-accent)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  );

  if (href) {
    return (
      <Link href={href} aria-label={label} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={classes}
    >
      {children}
    </button>
  );
}
