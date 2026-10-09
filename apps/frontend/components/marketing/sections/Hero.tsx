import Image from 'next/image';
import { BedDouble, GraduationCap, Router, Store } from 'lucide-react';
import { BUILT_FOR, HERO } from '@/features/marketing/config/content';
import { signUpHref, whatsappHref } from '@/features/marketing/config/site';
import { ButtonLink } from '../Button';
import { AnnouncementBadge } from '../AnnouncementBadge';
import { DeviceFrame } from '../DeviceFrame';
import { Parallax } from '../Parallax';
import { HeroFeatureRail } from '../HeroFeatureRail';
import { HeroAiCard } from '../HeroAiCard';
import { FloatingNav } from '../FloatingNav';

const VERTICAL_ICONS = [Store, BedDouble, Router, GraduationCap];

/** The provided app screenshot fills the device bezel exactly. */
function PhoneScreen() {
  return (
    <Image
      src="/images/marketing/phone-app.png"
      alt="HisaFlow inventory dashboard showing healthy items, low stock and stock health"
      fill
      priority
      sizes="(max-width: 1024px) 240px, 300px"
      className="object-cover object-top"
    />
  );
}

function DeviceCluster() {
  return (
    <div className="mt-16 grid grid-cols-1 justify-items-center gap-10 md:mt-20 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-10">
      <div className="order-2 w-full max-w-[340px] lg:order-1 lg:w-[300px] lg:max-w-none lg:justify-self-end">
        <HeroFeatureRail className="w-full" />
      </div>

      <div className="order-1 w-[240px] sm:w-[270px] md:col-span-2 lg:order-2 lg:col-span-1 lg:w-[300px]">
        <Parallax>
          <DeviceFrame>
            <PhoneScreen />
          </DeviceFrame>
        </Parallax>
      </div>

      <div className="order-3 w-full max-w-[340px] lg:order-3 lg:w-[300px] lg:max-w-none lg:justify-self-start">
        <HeroAiCard className="w-full" />
      </div>
    </div>
  );
}

function BuiltForRow() {
  return (
    <div className="mt-20 flex flex-col items-center">
      <p className="mk-small text-[var(--mk-ink-2)]">{BUILT_FOR.caption}</p>
      <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
        {BUILT_FOR.verticals.map((vertical, index) => {
          const Icon = VERTICAL_ICONS[index] ?? Store;
          return (
            <li
              key={vertical}
              className="flex items-center gap-2 text-[15px] font-semibold text-[var(--mk-ink-2)]"
            >
              <Icon className="h-5 w-5" strokeWidth={1.5} />
              {vertical}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Hero() {
  const wa = whatsappHref('general');

  return (
    <section className="mk-hero relative w-full pb-8 pt-3 md:pb-10 md:pt-4">
      <FloatingNav />

      <div className="mk-shell">
        <div className="mx-auto mt-14 flex max-w-4xl flex-col items-center text-center md:mt-20">
          <AnnouncementBadge
            chip={HERO.announcement.chip}
            text={HERO.announcement.text}
            href={HERO.announcement.href}
          />
          <h1
            id="top"
            className="mk-display mt-6 text-balance text-[var(--mk-ink)]"
          >
            {HERO.headline}
          </h1>
          <p className="mk-body-lg mt-5 max-w-[44ch] text-pretty text-[var(--mk-ink-2)]">
            {HERO.subheadline}
          </p>
          <div className="mt-7 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <ButtonLink href={signUpHref()} size="lg" variant="primary" withArrow>
              {HERO.primaryCta}
            </ButtonLink>
            <ButtonLink href="#industries" size="lg" variant="secondary">
              {HERO.secondaryCta}
            </ButtonLink>
          </div>
          <p className="mk-small mt-3 text-[var(--mk-ink-3)]">
            {HERO.microcopy}
          </p>
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="mk-small mt-1 font-medium text-[var(--mk-ink-2)] underline decoration-[var(--mk-ink-3)] underline-offset-4 hover:text-[var(--mk-ink)]"
            >
              Or chat with us on WhatsApp
            </a>
          ) : null}
        </div>

        <DeviceCluster />
        <BuiltForRow />
      </div>
    </section>
  );
}
