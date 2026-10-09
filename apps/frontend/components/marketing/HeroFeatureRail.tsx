'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { CreditCard, Landmark, Wallet } from 'lucide-react';
import { HERO_RAIL } from '@/features/marketing/config/content';
import { TagPill } from './TagPill';
import { cn } from '@/lib/utils';

const ICONS = {
  mpesa: Wallet,
  kra: Landmark,
  card: CreditCard,
} as const;

// Colour pairings from the visual-spec palette (Section 3.1) and core app
// accents: M-Pesa green, KRA blue, Card warm. Each circle is painted with a
// top-light/bottom-dark gradient plus layered inset highlights and a drop
// shadow, so the interlaced row reads as dimensional buttons rather than flat
// tints. Active fills are saturated; idle keeps a soft 3D tint.
const CIRCLE_3D =
  'shadow-[inset_0_1px_1px_rgba(255,255,255,0.85),inset_0_-3px_6px_rgba(0,0,0,0.22),0_8px_14px_-6px_rgba(16,24,40,0.45)]';

const CIRCLE_STYLES = {
  mpesa: {
    idle: 'bg-[linear-gradient(180deg,#F3FBF6_0%,#D6F0E1_52%,#ACE0C4_100%)] text-[#1F7A5A]',
    active:
      'bg-[linear-gradient(180deg,#4CC389_0%,#1F9D55_52%,#136B3B_100%)] text-white',
  },
  kra: {
    idle: 'bg-[linear-gradient(180deg,#F3F7FF_0%,#D6E7FB_52%,#AECFF4_100%)] text-[#1D4ED8]',
    active:
      'bg-[linear-gradient(180deg,#6BA0F8_0%,#2563EB_52%,#1A44B8_100%)] text-white',
  },
  card: {
    idle: 'bg-[linear-gradient(180deg,#FFF7F2_0%,#FFE1D2_52%,#FFC2A4_100%)] text-[#C2410C]',
    active:
      'bg-[linear-gradient(180deg,#FF9D70_0%,#FF5A1F_52%,#C93A08_100%)] text-white',
  },
} as const;

const ROTATE_MS = 5000;

/**
 * Hero capability card. Three interlaced icon circles sit inside the card
 * (rounded, 2px white border matching the card, negative left margin), and the
 * copy above updates to match the active circle. Advances on its own, pauses on
 * hover/focus, and is disabled under `prefers-reduced-motion`.
 */
export function HeroFeatureRail({ className }: { className?: string }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const panelId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (paused || typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => {
      setActive((current) => (current + 1) % HERO_RAIL.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  const select = useCallback((index: number, focus = false) => {
    setActive(index);
    if (focus) tabRefs.current[index]?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      select((active + 1) % HERO_RAIL.length, true);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      select((active - 1 + HERO_RAIL.length) % HERO_RAIL.length, true);
    }
  };

  const item = HERO_RAIL[active];

  return (
    <div
      className={cn(
        'w-[300px] rounded-[var(--mk-r-card)] bg-[var(--mk-surface)] p-5 shadow-[var(--mk-e2)]',
        className,
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Reserved row keeps the card height stable while the rail rotates. */}
      <div className="flex min-h-[32px] items-center justify-end">
        {item.comingSoonLabel ? (
          <TagPill tone="warm">{item.comingSoonLabel}</TagPill>
        ) : null}
      </div>

      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={`${panelId}-tab-${active}`}
        className="min-h-[132px]"
      >
        <h3 className="mk-h3 mt-3 text-[19px] text-[var(--mk-ink)]">
          {item.title}
        </h3>
        <p className="mk-small mt-2 text-[var(--mk-ink-2)]">
          {item.description}
        </p>
      </div>

      <div
        role="tablist"
        aria-label="HisaFlow capabilities"
        onKeyDown={onKeyDown}
        className="mt-5 flex items-center"
      >
        {HERO_RAIL.map((rail, index) => {
          const Icon = ICONS[rail.id];
          const style = CIRCLE_STYLES[rail.id];
          const selected = index === active;
          return (
            <button
              key={rail.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              id={`${panelId}-tab-${index}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={panelId}
              aria-label={rail.label}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(index)}
              className={cn(
                'relative -ml-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-[50%] border-2 border-[var(--mk-surface)] transition-[transform,box-shadow,background-color,color] duration-[var(--mk-dur-base)] ease-[var(--mk-ease)] first:ml-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mk-accent)] focus-visible:ring-offset-2',
                CIRCLE_3D,
                selected
                  ? cn('z-10 scale-105', style.active)
                  : cn('z-0 hover:-translate-y-0.5', style.idle),
              )}
            >
              {/* Specular highlight so the disc reads as a convex button. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-[7%] h-[34%] w-[64%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.95)_0%,rgba(255,255,255,0)_78%)]"
              />
              <Icon
                className="relative h-6 w-6 drop-shadow-[0_1px_1px_rgba(0,0,0,0.18)]"
                strokeWidth={1.5}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
