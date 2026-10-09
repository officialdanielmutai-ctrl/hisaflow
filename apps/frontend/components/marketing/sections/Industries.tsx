'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  BellRing,
  CalendarDays,
  GraduationCap,
  LogIn,
  PackageCheck,
  Radio,
  RefreshCw,
  Router,
  Store,
  Users,
  Wallet,
} from 'lucide-react';
import {
  INDUSTRIES,
  INDUSTRIES_SECTION,
  type Industry,
} from '@/features/marketing/config/content';
import { CLAIMS, isLive } from '@/features/marketing/config/claims';
import { signUpHref } from '@/features/marketing/config/site';
import { Section } from '../Section';
import { ButtonLink } from '../Button';
import { CircleButton } from '../CircleButton';
import { TagPill } from '../TagPill';
import { GlassChip } from '../GlassChip';
import { Reveal } from '../Reveal';
import { cn } from '@/lib/utils';

const INDUSTRY_ICONS: Record<string, typeof Store> = {
  shops: Store,
  'guest-houses': BedDouble,
  isps: Router,
  schools: GraduationCap,
};

const STACK_COLORS: Record<string, string> = {
  shops: 'var(--mk-accent)',
  'guest-houses': 'var(--color-accent-blue)',
  isps: 'var(--mk-accent-warm)',
  schools: 'var(--color-status-success)',
};

interface IndustryMediaData {
  icon: typeof Store;
  heading: string;
  metric: string;
  metricLabel: string;
}

/** Coded UI crops that stand in for photography (`visual-spec` Section 7.2). */
const INDUSTRY_MEDIA: Record<string, IndustryMediaData> = {
  shops: {
    icon: Wallet,
    heading: "Today's sales",
    metric: 'KES 48,350',
    metricLabel: 'M-Pesa, cash and card',
  },
  'guest-houses': {
    icon: BedDouble,
    heading: 'Rooms today',
    metric: '8 / 12',
    metricLabel: 'Occupied',
  },
  isps: {
    icon: Router,
    heading: 'Active routers',
    metric: '24',
    metricLabel: 'Across three zones',
  },
  schools: {
    icon: GraduationCap,
    heading: 'Fees collected',
    metric: 'KES 182,400',
    metricLabel: 'Term 2',
  },
};

/** Professional icons for the two floating metric tags on the visual card. */
const INDUSTRY_TAG_ICONS: Record<string, [typeof Store, typeof Store]> = {
  shops: [BellRing, PackageCheck],
  'guest-houses': [CalendarDays, LogIn],
  isps: [Router, RefreshCw],
  schools: [Wallet, Users],
};

/** Hand-drawn marker loop around a word (reference section-2 accents).
 *  The stroke draws itself as the word scrolls into view and retracts when the
 *  reader scrolls back up (transform-free, `stroke-dashoffset` only). */
function Encircled({
  children,
  strokeWidth = 2.8,
  sizeClassName = 'h-[2em] w-[calc(100%+1em)]',
}: {
  children: ReactNode;
  strokeWidth?: number;
  sizeClassName?: string;
}) {
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const path = pathRef.current;
    if (!wrapper || !path) return;

    const length =
      typeof path.getTotalLength === 'function' ? path.getTotalLength() : 0;
    if (!length) return;

    path.style.strokeDasharray = `${length}`;

    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      path.style.strokeDashoffset = '0';
      return;
    }

    path.style.strokeDashoffset = `${length}`;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = wrapper.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      const start = viewport * 0.95;
      const end = viewport * 0.5;
      const progress = Math.min(
        1,
        Math.max(0, (start - rect.top) / (start - end)),
      );
      path.style.strokeDashoffset = `${length * (1 - progress)}`;
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <span
      ref={wrapperRef}
      className="relative isolate inline-block whitespace-nowrap"
    >
      {children}
      <svg
        aria-hidden="true"
        viewBox="0 0 240 110"
        preserveAspectRatio="none"
        fill="none"
        className={cn(
          'pointer-events-none absolute left-1/2 top-[55%] -z-10 -translate-x-1/2 -translate-y-1/2 overflow-visible',
          sizeClassName,
        )}
      >
        <path
          ref={pathRef}
          d="M196 30C180 14 132 7 90 9 46 11 22 27 22 50c0 25 38 43 90 45 52 2 104-13 106-39 2-22-20-38-52-44"
          stroke="var(--mk-accent)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.92"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}

/** Replaces the first occurrence of `word` in `source` with an encircled one. */
function withEncircledWord(source: string, word: string) {
  const index = source.indexOf(word);
  if (index === -1) return source;
  return (
    <>
      {source.slice(0, index)}
      <Encircled>{word}</Encircled>
      {source.slice(index + word.length)}
    </>
  );
}

/** Colored, dimensional store badge used inline in the headline. */
function StoreBadge3D() {
  return (
    <span
      aria-hidden="true"
      className="mx-1 inline-flex h-[1.12em] w-[1.12em] translate-y-[0.14em] items-center justify-center rounded-[0.32em] bg-gradient-to-br from-[#34b27f] via-[#1f7a5a] to-[#14523d] align-middle shadow-[0_5px_12px_-3px_rgba(31,122,90,0.55),inset_0_1px_0_rgba(255,255,255,0.5)] ring-1 ring-inset ring-white/30"
    >
      <Store
        className="h-[0.66em] w-[0.66em] text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]"
        strokeWidth={1.75}
      />
    </span>
  );
}

function IndustryMedia({ id }: { id: string }) {
  const data = INDUSTRY_MEDIA[id] ?? INDUSTRY_MEDIA.shops;
  const Icon = data.icon;

  return (
    <div className="flex h-full w-full flex-col justify-between bg-gradient-to-br from-[var(--color-bg-secondary)] via-[var(--mk-surface)] to-[var(--color-bg-elevated)] p-5">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--mk-ink)]">
        <Icon className="h-4 w-4" strokeWidth={1.5} />
        {data.heading}
      </div>
      <div>
        <p className="mk-tabular text-[clamp(2rem,1.4rem+2.4vw,2.75rem)] font-bold leading-none text-[var(--mk-ink)]">
          {data.metric}
        </p>
        <p className="mt-2 text-[11px] text-[var(--mk-ink-2)]">
          {data.metricLabel}
        </p>
      </div>
      <div aria-hidden="true" className="flex h-14 items-end gap-1.5">
        {[38, 62, 48, 78, 56, 88, 70].map((height, index) => (
          <span
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            className="flex-1 rounded-[4px] bg-[var(--mk-accent)] opacity-20"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function IndustryStack({
  active,
  onSelect,
}: {
  active: number;
  onSelect: (index: number) => void;
}) {
  return (
    <ul className="flex items-center" aria-label="Industries">
      {INDUSTRIES.map((item, index) => {
        const Icon = INDUSTRY_ICONS[item.id] ?? Store;
        const isActive = index === active;
        return (
          <li key={item.id} className={cn(index > 0 && '-ml-3')}>
            <button
              type="button"
              onClick={() => onSelect(index)}
              aria-label={`Show ${item.name}`}
              aria-pressed={isActive}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-[var(--mk-r-pill)] border-2 border-white text-white outline-none transition-transform duration-[var(--mk-dur-fast)] ease-[var(--mk-ease)] hover:scale-105 focus-visible:ring-2 focus-visible:ring-[var(--mk-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mk-ink)]',
                isActive ? 'z-10 scale-105' : 'bg-white/10',
              )}
              style={
                isActive
                  ? { backgroundColor: STACK_COLORS[item.id] }
                  : undefined
              }
            >
              <Icon className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function IndustryFeatureCard({
  industry,
  live,
  active,
  onSelect,
}: {
  industry: Industry;
  live: boolean;
  active: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex flex-col rounded-[var(--mk-r-card)] border border-white/10 bg-[var(--mk-ink)] p-6 text-white md:p-8">
      <p className="mk-eyebrow text-white/60">{industry.name}</p>
      <p className="mk-h3 mt-3 text-[20px] text-white">{industry.outcome}</p>
      <p className="mk-small mt-3 text-white/70">{industry.pain}</p>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-8">
        <IndustryStack active={active} onSelect={onSelect} />
        <div className="flex items-center gap-3">
          {live ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/80">
              <Radio
                aria-hidden="true"
                className="h-3.5 w-3.5 text-[var(--mk-accent)]"
                strokeWidth={1.75}
              />
              Live
            </span>
          ) : null}
          <TagPill tone="dark">{industry.moduleTag}</TagPill>
        </div>
      </div>
    </div>
  );
}

export function Industries() {
  const [active, setActive] = useState(0);
  const industry = INDUSTRIES[active];
  const count = INDUSTRIES.length;
  const live = isLive(CLAIMS[industry.claimKey]);
  const [TagIconA, TagIconB] =
    INDUSTRY_TAG_ICONS[industry.id] ?? INDUSTRY_TAG_ICONS.shops;

  const goTo = (next: number) => {
    setActive(Math.max(0, Math.min(count - 1, next)));
  };

  return (
    <Section
      id="industries"
      className="mk-ref !max-w-none !px-0"
      innerClassName="p-6 shadow-[var(--mk-e1)] md:p-10 lg:p-16"
      contentClassName="mx-auto w-full max-w-[1360px]"
    >
      <Reveal>
        {/* Header labels removed; the headline leads the section. */}
        <div className="grid gap-5 lg:grid-cols-12 lg:items-end lg:gap-8">
        <h2 className="mk-h2 text-balance lg:col-span-8">
          {INDUSTRIES_SECTION.headlineBefore}
          <StoreBadge3D />
          {withEncircledWord(INDUSTRIES_SECTION.headlineAfter, 'actually')}
        </h2>
        <p className="mk-body-lg text-[var(--mk-ink)] lg:col-span-4">
          {INDUSTRIES_SECTION.intro}
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-[1fr_1.5fr_1.5fr] lg:items-stretch">
        {/* Counter + navigation */}
        <div className="flex flex-row items-end justify-between gap-4 md:col-span-2 lg:col-span-1 lg:flex-col lg:items-start lg:justify-between lg:py-2">
          <div>
            <p className="mk-numeral text-[var(--mk-ink)]">
              {String(active + 1).padStart(2, '0')}
              <span className="text-[0.4em] text-[var(--mk-ink-3)]">
                {' '}
                /{count}
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <CircleButton
              label="Previous industry"
              onClick={() => goTo(active - 1)}
              disabled={active === 0}
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
            </CircleButton>
            <CircleButton
              label="Next industry"
              variant="accent"
              className="mk-core-accent"
              onClick={() => goTo(active + 1)}
              disabled={active === count - 1}
            >
              <ArrowRight className="h-5 w-5" strokeWidth={1.5} />
            </CircleButton>
          </div>
        </div>

        {/* Active industry feature card */}
        <div aria-live="polite">
          <IndustryFeatureCard
            industry={industry}
            live={live}
            active={active}
            onSelect={setActive}
          />
        </div>

        {/* Visual card with two floating metric tags (reference block 1). */}
        <div className="relative min-h-[320px] overflow-hidden rounded-[var(--mk-r-card)]">
          <div aria-hidden="true" className="absolute inset-0">
            <IndustryMedia id={industry.id} />
          </div>
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent"
          />
          <GlassChip
            icon={<TagIconA strokeWidth={1.75} />}
            className="mk-float-panel absolute right-4 top-4 bg-black/65"
          >
            {industry.mediaTags[0]}
          </GlassChip>
          <GlassChip
            icon={<TagIconB strokeWidth={1.75} />}
            className="mk-float-panel absolute bottom-4 left-4 bg-black/65"
          >
            {industry.mediaTags[1]}
          </GlassChip>
        </div>
      </div>

      <div className="mt-8">
        <ButtonLink
          href={signUpHref()}
          variant="accent"
          withArrow
          className="mk-core-accent"
        >
          Start free trial
        </ButtonLink>
      </div>
      </Reveal>
    </Section>
  );
}
