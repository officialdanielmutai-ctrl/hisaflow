import { notFound } from 'next/navigation';
import { ArrowUpRight, Bell, Package, Receipt, Store, Smartphone } from 'lucide-react';
import {
  Button,
  ButtonLink,
  CircleArrow,
} from '@/components/marketing/Button';
import { CircleButton } from '@/components/marketing/CircleButton';
import { Eyebrow } from '@/components/marketing/Eyebrow';
import { TagPill } from '@/components/marketing/TagPill';
import { GlassChip } from '@/components/marketing/GlassChip';
import { AnnouncementBadge } from '@/components/marketing/AnnouncementBadge';
import { BentoCard } from '@/components/marketing/BentoCard';
import { ProductChip } from '@/components/marketing/ProductChip';
import { Section } from '@/components/marketing/Section';

// Dev-only surface. It is never prerendered and 404s in production unless the
// gallery is explicitly enabled, so no internal tooling can leak live.
// (`hisaflow-landing-visual-spec.md` Layer V-1.)
export const dynamic = 'force-dynamic';

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-[var(--mk-line)] py-8">
      <p className="mk-eyebrow text-[var(--mk-ink-3)]">{title}</p>
      <div className="mt-5 flex flex-wrap items-center gap-4">{children}</div>
    </div>
  );
}

export default function GalleryPage() {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PUBLIC_ENABLE_GALLERY !== 'true'
  ) {
    notFound();
  }

  return (
    <div className="mk-stack pb-3 md:pb-4">
      <Section innerClassName="px-6 py-12 md:px-10 md:py-16">
        <Eyebrow>Internal</Eyebrow>
        <h1 className="mk-h2 mt-4">Component gallery</h1>
        <p className="mk-small mt-3 max-w-[60ch] text-[var(--mk-ink-2)]">
          Every primitive, variant and state in one place. This route is for
          build review only and is excluded from the sitemap.
        </p>

        <Row title="Button: variants">
          <Button variant="primary" withArrow>
            Primary
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="accent" withArrow>
            Accent
          </Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </Row>

        <Row title="Button: sizes and links">
          <ButtonLink href="/sign-up" size="lg" variant="primary" withArrow>
            Large
          </ButtonLink>
          <ButtonLink href="/sign-up" size="md" variant="primary" withArrow>
            Medium
          </ButtonLink>
          <ButtonLink href="/sign-up" variant="inverse">
            Inverse
          </ButtonLink>
          <span className="flex h-[52px] items-center gap-3 rounded-[var(--mk-r-pill)] bg-[var(--mk-ink)] pr-2 pl-6 text-[15px] font-semibold text-white">
            Custom <CircleArrow />
          </span>
        </Row>

        <Row title="Eyebrow · TagPill · GlassChip · ProductChip">
          <Eyebrow>Light eyebrow</Eyebrow>
          <span className="rounded-[var(--mk-r-inner)] bg-[var(--mk-ink)] p-3">
            <Eyebrow tone="dark">Dark eyebrow</Eyebrow>
          </span>
          <TagPill>Light tag</TagPill>
          <TagPill tone="accent">Accent tag</TagPill>
          <span className="rounded-[var(--mk-r-inner)] bg-[var(--mk-ink)] p-3">
            <TagPill tone="dark">Dark tag</TagPill>
          </span>
          <span className="rounded-[var(--mk-r-inner)] bg-[linear-gradient(120deg,#1F7A5A,#0B0C0E)] p-4">
            <GlassChip>Glass chip</GlassChip>
          </span>
          <p className="mk-h3">
            In <ProductChip>stock</ProductChip> now
          </p>
        </Row>

        <Row title="CircleButton">
          <CircleButton label="Outline">
            <ArrowUpRight className="h-5 w-5" strokeWidth={1.5} />
          </CircleButton>
          <CircleButton label="Ink" variant="ink">
            <Bell className="h-5 w-5" strokeWidth={1.5} />
          </CircleButton>
          <CircleButton label="Accent" variant="accent">
            <ArrowUpRight className="h-5 w-5" strokeWidth={1.5} />
          </CircleButton>
          <CircleButton label="Large accent" variant="accent" size="lg">
            <ArrowUpRight className="h-6 w-6" strokeWidth={1.5} />
          </CircleButton>
          <CircleButton label="Disabled" disabled>
            <Package className="h-5 w-5" strokeWidth={1.5} />
          </CircleButton>
        </Row>

        <Row title="AnnouncementBadge">
          <AnnouncementBadge
            chip="Early access"
            text="Built in Kenya for Kenyan businesses"
            href="#industries"
          />
        </Row>

        <Row title="BentoCard tones">
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <BentoCard tone="surface">
              <h3 className="mk-h3">Surface</h3>
              <p className="mk-small mt-2 text-[var(--mk-ink-2)]">
                Default white tile.
              </p>
            </BentoCard>
            <BentoCard tone="accent">
              <h3 className="mk-h3">Accent</h3>
              <p className="mk-small mt-2 opacity-75">Solid accent tile.</p>
            </BentoCard>
            <BentoCard tone="ink">
              <h3 className="mk-h3">Ink</h3>
              <p className="mk-small mt-2 text-white/70">Dark tile.</p>
            </BentoCard>
            <BentoCard tone="outline">
              <h3 className="mk-h3">Outline</h3>
              <p className="mk-small mt-2 text-[var(--mk-ink-2)]">
                Hairline tile.
              </p>
            </BentoCard>
          </div>
        </Row>

        <Row title="Icon sizes (1.5px stroke)">
          <Store className="h-5 w-5" strokeWidth={1.5} />
          <Receipt className="h-5 w-5" strokeWidth={1.5} />
          <Smartphone className="h-6 w-6" strokeWidth={1.5} />
        </Row>
      </Section>
    </div>
  );
}
