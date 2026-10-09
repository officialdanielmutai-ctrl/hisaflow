import {
  AlertTriangle,
  CalendarDays,
  Landmark,
  Package,
  Receipt,
  Wallet,
} from 'lucide-react';
import { PROBLEM, type ProblemCard } from '@/features/marketing/config/content';
import { CLAIMS, isLive } from '@/features/marketing/config/claims';
import { signUpHref } from '@/features/marketing/config/site';
import { ButtonLink } from '../Button';
import { TagPill } from '../TagPill';
import { BentoCard } from '../BentoCard';
import { Reveal } from '../Reveal';
import { cn } from '@/lib/utils';

const CARD_ICONS: Record<ProblemCard['id'], typeof Package> = {
  stock: Package,
  payments: Wallet,
  tax: Landmark,
  admin: CalendarDays,
};

const BADGES = [Package, Receipt, Wallet, CalendarDays];

/** Full-bleed low-stock UI crop used as the tile background. */
function StockMedia() {
  return (
    <div className="flex h-full w-full flex-col gap-3 bg-[var(--color-bg-elevated)] p-4">
      <div className="rounded-[var(--mk-r-sm)] bg-[var(--mk-surface)] p-4 shadow-[var(--mk-e1)]">
        <p className="text-[10px] font-medium text-[var(--mk-ink-2)]">
          Today&apos;s sales
        </p>
        <p className="mk-tabular mt-0.5 text-[20px] font-bold text-[var(--mk-ink)]">
          KES 48,350
        </p>
      </div>
      <div className="rounded-[var(--mk-r-sm)] bg-[var(--mk-surface)] p-4 shadow-[var(--mk-e1)]">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--color-status-warning)]">
          <AlertTriangle className="h-3 w-3" strokeWidth={2} />
          Low stock
        </p>
        <ul className="mt-2 flex flex-col gap-2 text-[11px] text-[var(--mk-ink-2)]">
          {[
            { name: 'Cooking oil 1L', left: '1 left' },
            { name: 'Unga 2kg', left: '2 left' },
            { name: 'Sugar 1kg', left: '4 left' },
          ].map((item) => (
            <li
              key={item.name}
              className="flex items-center justify-between gap-2"
            >
              <span className="truncate">{item.name}</span>
              <span className="mk-tabular shrink-0 font-semibold text-[var(--mk-ink)]">
                {item.left}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Full-bleed booking UI crop used as the tile background. */
function AdminMedia() {
  return (
    <div className="flex h-full w-full flex-col gap-3 bg-[#2d3748] p-4">
      <div className="rounded-[var(--mk-r-sm)] bg-white/10 p-4">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold text-white/85">
          <CalendarDays className="h-3 w-3" strokeWidth={1.5} />
          Today
        </p>
        <ul className="mt-2 flex flex-col gap-2 text-[11px] text-white/70">
          <li className="flex items-center justify-between gap-2">
            <span>Room 4 · check-in</span>
            <span className="font-semibold text-[#7ee2b8]">Paid</span>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span>Room 7 · check-out</span>
            <span>11:00</span>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span>Room 2 · booking</span>
            <span>14:00</span>
          </li>
        </ul>
      </div>
      <div className="rounded-[var(--mk-r-sm)] bg-white/10 p-4">
        <p className="text-[10px] font-medium text-white/70">Occupied rooms</p>
        <p className="mk-tabular mt-0.5 text-[20px] font-bold text-white">
          8 / 12
        </p>
      </div>
    </div>
  );
}

function ProblemTile({ card }: { card: ProblemCard }) {
  const gated = card.claimKey != null && !isLive(CLAIMS[card.claimKey]);
  const onDark =
    card.tone === 'accent' || card.tone === 'ink' || card.tone === 'blue';
  const isMedia = card.id === 'stock' || card.id === 'admin';
  const Icon = CARD_ICONS[card.id];

  // Imagery tiles: the image fills the whole (taller) tile; a compact frosted
  // panel carries the copy on top.
  if (isMedia) {
    return (
      <article className="relative min-h-[340px] overflow-hidden rounded-[20px]">
        <div aria-hidden="true" className="absolute inset-0">
          {card.id === 'stock' ? <StockMedia /> : <AdminMedia />}
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"
        />
        <div className="relative z-10 flex h-full min-h-[340px] items-end p-3">
          <div className="mk-glass-panel w-full rounded-[14px] p-3 shadow-[var(--mk-e1)]">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] text-[var(--mk-accent)]">
                <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
              </span>
              <p className="mk-eyebrow text-[10px] text-[var(--mk-ink-3)]">
                {card.problem}
              </p>
            </div>
            <h3 className="mt-2 text-[15px] font-semibold leading-snug text-[var(--mk-ink)]">
              {card.title}
            </h3>
            <p className="mt-1 text-[12px] leading-snug text-[var(--mk-ink-2)]">
              {card.description}
            </p>
          </div>
        </div>
      </article>
    );
  }

  // Solid-colour tiles keep their own natural size (do not stretch).
  return (
    <BentoCard tone={card.tone} className="rounded-[20px]">
      <span
        aria-hidden="true"
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full',
          onDark
            ? 'bg-white/15 text-white'
            : 'bg-[var(--color-bg-secondary)] text-[var(--mk-accent)]',
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.5} />
      </span>

      <p
        className={cn(
          'mk-eyebrow mt-3',
          onDark ? 'text-white' : 'text-[var(--mk-ink-3)]',
        )}
      >
        {card.problem}
      </p>
      <h3
        className={cn(
          'mk-h3 mt-1 text-[17px]',
          onDark ? 'text-white' : 'text-[var(--mk-ink)]',
        )}
      >
        {card.title}
      </h3>
      <p
        className={cn(
          'mk-small mt-2',
          onDark ? 'text-white' : 'text-[var(--mk-ink-2)]',
        )}
      >
        {card.description}
      </p>

      {card.chips ? (
        <ul className="mt-auto flex flex-wrap gap-1.5 pt-4">
          {card.chips.map((chip) => (
            <li key={chip}>
              <TagPill tone={onDark ? 'dark' : 'light'}>{chip}</TagPill>
            </li>
          ))}
        </ul>
      ) : null}

      {card.footer ? (
        <div className="mt-auto pt-4">
          <span
            className={cn(
              'mk-small inline-flex h-8 items-center rounded-[var(--mk-r-pill)] px-3 font-medium',
              gated
                ? 'bg-[rgba(255,90,31,0.14)] text-[var(--mk-accent-warm-ink)]'
                : 'bg-[var(--color-bg-elevated)] text-[var(--mk-ink-2)]',
            )}
          >
            {card.footer}
          </span>
        </div>
      ) : null}
    </BentoCard>
  );
}

export function Problem() {
  // Two balanced columns so the tall imagery tiles sit diagonally and the
  // solid tiles keep their natural size. Mobile order is unchanged.
  const leftColumn = PROBLEM.cards.slice(0, 2);
  const rightColumn = PROBLEM.cards.slice(2);

  return (
    <section className="mk-problem w-full pb-12 pt-6 md:pb-16 md:pt-10">
      <div className="mk-shell">
        <Reveal>
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-12">
          <div>
            <h2 className="mk-h2 max-w-[16ch] text-balance text-[var(--mk-ink)]">
              {PROBLEM.headline}
            </h2>
            <p className="mk-body-lg mt-5 max-w-[48ch] text-[var(--mk-ink-2)]">
              {PROBLEM.intro}
            </p>
            <p className="mk-body-lg mt-5 max-w-[48ch] border-l-2 border-[var(--mk-accent)] pl-4 font-medium text-[var(--mk-ink)]">
              {PROBLEM.resolution}
            </p>

            <div className="mt-7">
              <ButtonLink href={signUpHref()} variant="accent" withArrow>
                {PROBLEM.cta}
              </ButtonLink>
            </div>

            <ul className="mt-7 flex flex-wrap gap-3">
              {BADGES.map((Icon, index) => (
                <li
                  // eslint-disable-next-line react/no-array-index-key
                  key={index}
                  className="flex h-11 w-14 items-center justify-center rounded-[var(--mk-r-pill)] bg-[var(--color-bg-elevated)] text-[var(--mk-ink-2)]"
                >
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-4">
              {leftColumn.map((card) => (
                <ProblemTile key={card.id} card={card} />
              ))}
            </div>
            <div className="flex flex-col gap-4">
              {rightColumn.map((card) => (
                <ProblemTile key={card.id} card={card} />
              ))}
            </div>
          </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
