'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ParallaxProps {
  children: ReactNode;
  /** Fraction of the page scroll the element lags by (0 disables). */
  speed?: number;
  /** Maximum travel in pixels, so the effect never drifts too far. */
  max?: number;
  className?: string;
}

/**
 * A restrained scroll parallax used for the hero device (visual-spec Section 6
 * allows parallax on the hero cards). Animates transform only, runs inside a
 * rAF, and is disabled for `prefers-reduced-motion`.
 */
export function Parallax({
  children,
  speed = 0.16,
  max = 48,
  className,
}: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const y = Math.min(window.scrollY * speed, max);
      el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      el.style.transform = '';
    };
  }, [speed, max]);

  return (
    <div ref={ref} className={cn('will-change-transform', className)}>
      {children}
    </div>
  );
}
