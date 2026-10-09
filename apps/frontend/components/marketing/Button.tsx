import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'inverse';
export type ButtonSize = 'lg' | 'md';

interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  withArrow?: boolean;
  className?: string;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--mk-ink)] text-white hover:opacity-90 active:scale-[.98]',
  secondary:
    'border border-[var(--mk-ink)] text-[var(--mk-ink)] hover:bg-[var(--color-bg-elevated)] active:scale-[.98]',
  accent:
    'bg-[var(--mk-accent)] text-[var(--mk-accent-ink)] hover:bg-[var(--mk-accent-hover)] active:scale-[.98]',
  ghost:
    'text-[var(--mk-ink)] hover:bg-[var(--color-bg-elevated)] active:scale-[.98]',
  inverse:
    'border border-white/35 text-white hover:bg-white/10 active:scale-[.98]',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  lg: 'h-[52px] px-6 text-[15px]',
  md: 'h-11 px-5 text-sm',
};

const ARROW_WRAPPER_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--mk-surface)] text-[var(--mk-ink)]',
  accent: 'bg-[var(--mk-ink)] text-[var(--mk-accent-ink)]',
  secondary: 'bg-[var(--mk-ink)] text-white',
  ghost: 'bg-[var(--mk-ink)] text-white',
  inverse: 'bg-white text-[var(--mk-ink)]',
};

export function buttonClasses({
  variant = 'primary',
  size = 'lg',
  withArrow = false,
  className,
}: ButtonStyleOptions = {}): string {
  return cn(
    'group/btn inline-flex shrink-0 items-center justify-center gap-3 rounded-[var(--mk-r-pill)] font-semibold whitespace-nowrap transition-[background-color,opacity,transform] duration-[var(--mk-dur-fast)] ease-[var(--mk-ease)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--mk-accent)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    withArrow && 'pr-2',
    className,
  );
}

export function CircleArrow({ variant = 'primary' }: { variant?: ButtonVariant }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-[var(--mk-r-pill)] transition-transform duration-[var(--mk-dur-base)] ease-[var(--mk-ease)] group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5',
        ARROW_WRAPPER_CLASSES[variant],
      )}
    >
      <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
    </span>
  );
}

interface ButtonLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className' | 'children'> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  withArrow?: boolean;
  className?: string;
  children: ReactNode;
  /** External links use a plain anchor; internal links use next/link. */
  external?: boolean;
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'lg',
  withArrow = false,
  className,
  children,
  external = false,
  ...rest
}: ButtonLinkProps) {
  const classes = buttonClasses({ variant, size, withArrow, className });
  const content = (
    <>
      <span>{children}</span>
      {withArrow ? <CircleArrow variant={variant} /> : null}
    </>
  );

  if (external || href.startsWith('http') || href.startsWith('#')) {
    return (
      <a href={href} className={classes} {...rest}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={classes} {...rest}>
      {content}
    </Link>
  );
}

interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  withArrow?: boolean;
  className?: string;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'lg',
  withArrow = false,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, withArrow, className })}
      {...rest}
    >
      <span>{children}</span>
      {withArrow ? <CircleArrow variant={variant} /> : null}
    </button>
  );
}
