'use client';

import { useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { CircleButton } from './CircleButton';
import { cn } from '@/lib/utils';

interface SnapCarouselProps {
  items: ReactNode[];
  ariaLabel: string;
  className?: string;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * CSS scroll-snap carousel with a counter and prev/next buttons, no library
 * (`hisaflow-landing-visual-spec.md` Sections 4.8 and 5.4).
 */
export function SnapCarousel({ items, ariaLabel, className }: SnapCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = Math.max(items.length, 1);

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(count - 1, next));
    setIndex(clamped);
    const track = trackRef.current;
    const child = track?.children[clamped] as HTMLElement | undefined;
    if (track && child) {
      track.scrollTo({
        left: child.offsetLeft - track.offsetLeft,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
    }
  };

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const children = Array.from(track.children) as HTMLElement[];
    const center = track.scrollLeft + track.clientWidth / 2;
    let nearest = 0;
    let best = Number.POSITIVE_INFINITY;
    children.forEach((child, i) => {
      const childCenter =
        child.offsetLeft - track.offsetLeft + child.clientWidth / 2;
      const distance = Math.abs(childCenter - center);
      if (distance < best) {
        best = distance;
        nearest = i;
      }
    });
    setIndex(nearest);
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-4">
        <p className="mk-numeral text-[var(--mk-ink)]">
          {String(index + 1).padStart(2, '0')}
          <span className="text-[0.4em] text-[var(--mk-ink-3)]"> /{count}</span>
        </p>
        <div className="flex gap-2">
          <CircleButton
            label="Previous item"
            onClick={() => goTo(index - 1)}
            disabled={index <= 0}
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
          </CircleButton>
          <CircleButton
            label="Next item"
            variant="accent"
            onClick={() => goTo(index + 1)}
            disabled={index >= count - 1}
          >
            <ArrowRight className="h-5 w-5" strokeWidth={1.5} />
          </CircleButton>
        </div>
      </div>

      <div
        ref={trackRef}
        onScroll={handleScroll}
        aria-label={ariaLabel}
        className={cn(
          'mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1',
          '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
        {items.map((item, i) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            className="w-[82%] shrink-0 snap-start"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
