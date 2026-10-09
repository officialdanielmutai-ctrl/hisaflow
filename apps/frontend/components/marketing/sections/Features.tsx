import {
  ArrowUpRight,
  Camera,
  Mic,
  ReceiptText,
  ScanBarcode,
  Sparkles,
} from 'lucide-react';
import { FEATURES, type Feature } from '@/features/marketing/config/content';
import { signUpHref } from '@/features/marketing/config/site';
import { Section } from '../Section';
import { ProductChip } from '../ProductChip';
import { CircleButton } from '../CircleButton';
import { TagPill } from '../TagPill';
import { BentoCard } from '../BentoCard';
import { FeatureVisual } from '../FeatureVisual';
import { FeatureScanAnimation } from '../FeatureScanAnimation';
import { Reveal } from '../Reveal';

const TILE_IDS: Feature['id'][] = ['barcode', 'label', 'receipt'];

const FEATURE_PILLS = [
  { label: 'Barcode scanning', Icon: ScanBarcode },
  { label: 'Label scanning', Icon: Camera },
  { label: 'Receipt capture', Icon: ReceiptText },
  { label: 'AI ingestion', Icon: Sparkles },
] as const;

/** Honest upcoming capability (voice entry is not shipped yet). */
function ComingSoonCard() {
  return (
    <div className="mk-float-panel -mx-6 w-[calc(100%+3rem)] shrink-0 rounded-[var(--mk-r-card)] bg-[var(--color-bg-elevated)] p-3 md:mx-0 md:w-[168px]">
      <div className="rounded-[var(--mk-r-inner)] bg-[var(--mk-surface)] p-3">
        <Mic
          className="h-4 w-4 text-[var(--mk-accent-warm)]"
          strokeWidth={1.5}
        />
        <p className="mt-2 text-[12px] font-semibold text-[var(--mk-ink)]">
          Voice input
        </p>
        <p className="text-[10px] text-[var(--mk-ink-2)]">
          Say a sale, we record it
        </p>
      </div>
      <div className="mt-2">
        <TagPill tone="warm">Coming soon</TagPill>
      </div>
    </div>
  );
}

export function Features() {
  const tiles = FEATURES.items.filter((item) =>
    (TILE_IDS as string[]).includes(item.id),
  );

  return (
    <Section
      id="features"
      className="mk-ref !max-w-none !px-0"
      innerClassName="mk-mesh-features !rounded-none p-6 md:p-10 lg:p-16"
      contentClassName="mx-auto w-full max-w-[1360px]"
    >
      <Reveal>
        <div className="grid gap-10 md:grid-cols-[1.1fr_1fr] md:items-center md:gap-8 lg:gap-14">
        {/* Mobile: the copy leads and the animation follows; from tablet up
            the media sits on the left. */}
        <div className="order-2 md:order-1">
          <FeatureScanAnimation />
        </div>

        <div className="order-1 md:order-2">
          <h2 className="mk-h2 text-balance">
            {FEATURES.headlineBefore}
            <ProductChip>{FEATURES.headlineChip}</ProductChip>
            {FEATURES.headlineAfter}
          </h2>

          <ul
            className="mt-6 flex flex-wrap items-center gap-2"
            aria-label="Scanning and AI coverage"
          >
            {FEATURE_PILLS.map(({ label, Icon }) => (
              <li
                key={label}
                className="flex h-10 w-10 items-center justify-center rounded-[var(--mk-r-pill)] border border-[var(--mk-line)] bg-[var(--mk-surface)] text-[var(--mk-ink-2)]"
              >
                <Icon className="h-4 w-4" strokeWidth={1.5} />
                <span className="sr-only">{label}</span>
              </li>
            ))}
            <li>
              <TagPill tone="accent">+2</TagPill>
            </li>
          </ul>

          <p className="mk-body-lg mt-5 max-w-[48ch] text-[var(--mk-ink-2)]">
            {FEATURES.intro}
          </p>

          <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
            <div className="flex items-center gap-4">
              <CircleButton
                size="lg"
                variant="accent"
                className="mk-core-accent"
                href={signUpHref()}
                label="Streamline your process"
              >
                <ArrowUpRight className="h-6 w-6" strokeWidth={1.5} />
              </CircleButton>
              <span className="mk-small font-medium text-[var(--mk-ink-2)]">
                Streamline your process
              </span>
            </div>

            <ComingSoonCard />
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
        {tiles.map((item) => (
          <BentoCard
            key={item.id}
            tone="surface"
            className="h-full border border-[var(--mk-line)] shadow-[var(--mk-e-accent)]"
          >
            <div className="mb-4">
              <FeatureVisual
                variant={item.id as 'barcode' | 'label' | 'receipt'}
              />
            </div>
            <h3 className="mk-h3 text-[20px]">{item.title}</h3>
            <p className="mk-small mt-2 text-[var(--mk-ink-2)]">
              {item.description}
            </p>
          </BentoCard>
        ))}
      </div>
      </Reveal>
    </Section>
  );
}
