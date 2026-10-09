import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GlassChipProps {
  children: ReactNode;
  /** Optional leading icon, sized in em so it scales with the chip copy. */
  icon?: ReactNode;
  className?: string;
}

/**
 * Frosted label over imagery (`hisaflow-landing-visual-spec.md` Section 4.9).
 * Contrast fallback for browsers without backdrop-filter lives in globals.css.
 */
export function GlassChip({ children, icon, className }: GlassChipProps) {
  return (
    <span
      className={cn(
        'mk-glass mk-small inline-flex h-8 items-center gap-1.5 rounded-[var(--mk-r-pill)] px-3 font-medium text-white',
        className,
      )}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex [&_svg]:h-3.5 [&_svg]:w-3.5">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
