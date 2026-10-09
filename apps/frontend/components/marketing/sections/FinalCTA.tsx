import { FINAL_CTA } from '@/features/marketing/config/content';
import { signUpHref, whatsappHref } from '@/features/marketing/config/site';
import { Section } from '../Section';
import { ButtonLink } from '../Button';
import { Reveal } from '../Reveal';

export function FinalCTA() {
  const wa = whatsappHref('general');

  return (
    <Section
      id="final-cta"
      tone="ink"
      innerClassName="px-6 py-14 md:px-10 md:py-20"
    >
      <Reveal className="flex flex-col items-center text-center">
        <h2 className="mk-h2 max-w-[20ch] text-balance text-white">
          {FINAL_CTA.headline}
        </h2>
        <p className="mk-body-lg mt-4 text-white/70">{FINAL_CTA.subline}</p>
        <div className="mt-7 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
          <ButtonLink href={signUpHref()} variant="accent" withArrow>
            {FINAL_CTA.primaryCta}
          </ButtonLink>
          {wa ? (
            <ButtonLink href={wa} external variant="inverse">
              {FINAL_CTA.secondaryCta}
            </ButtonLink>
          ) : null}
        </div>
      </Reveal>
    </Section>
  );
}
