'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Building2, CheckCircle2, UserPlus } from 'lucide-react';
import { HOW_IT_WORKS } from '@/features/marketing/config/content';
import { Section } from '../Section';
import { TagPill } from '../TagPill';
import { ProductChip } from '../ProductChip';
import { Reveal } from '../Reveal';
import { cn } from '@/lib/utils';

function StepVisual({ stepId }: { stepId: string }) {
  if (stepId === 'account') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--mk-ink)]">
          <UserPlus className="h-4 w-4" strokeWidth={1.5} />
          Create account
        </div>
        <div className="rounded-[var(--mk-r-sm)] border border-[var(--mk-line)] px-3 py-2 text-[12px] text-[var(--mk-ink-3)]">
          you@example.com
        </div>
        <div className="rounded-[var(--mk-r-sm)] border border-[var(--mk-line)] px-3 py-2 text-[12px] text-[var(--mk-ink-3)]">
          +254 7·· ··· ···
        </div>
        <div className="rounded-[var(--mk-r-pill)] bg-[var(--mk-ink)] px-4 py-2 text-center text-[12px] font-semibold text-white">
          Continue
        </div>
      </div>
    );
  }

  if (stepId === 'business') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--mk-ink)]">
          <Building2 className="h-4 w-4" strokeWidth={1.5} />
          Business type
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['Duka', 'Guest house', 'ISP', 'School'].map((type, index) => (
            <span
              key={type}
              className={cn(
                'inline-flex h-7 items-center rounded-[var(--mk-r-pill)] px-3 text-[11px] font-medium',
                index === 0
                  ? 'bg-[var(--mk-accent)] text-[var(--mk-accent-ink)]'
                  : 'border border-[var(--mk-line)] text-[var(--mk-ink-2)]',
              )}
            >
              {type}
            </span>
          ))}
        </div>
        <div className="rounded-[var(--mk-r-sm)] border border-[var(--mk-line)] px-3 py-2 text-[12px] text-[var(--mk-ink-3)]">
          Business name
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--mk-ink)]">
        <CheckCircle2
          className="h-4 w-4 text-[var(--mk-accent)]"
          strokeWidth={1.5}
        />
        Sale recorded
      </div>
      <ul className="mk-tabular flex flex-col gap-2 text-[12px] text-[var(--mk-ink-2)]">
        <li className="flex justify-between gap-3">
          <span>Unga 2kg × 1</span>
          <span className="font-semibold text-[var(--mk-ink)]">KES 210</span>
        </li>
        <li className="flex justify-between gap-3">
          <span>Sugar 1kg × 2</span>
          <span className="font-semibold text-[var(--mk-ink)]">KES 320</span>
        </li>
        <li className="flex justify-between gap-3 border-t border-[var(--mk-line)] pt-2">
          <span>Total</span>
          <span className="font-semibold text-[var(--mk-ink)]">KES 530</span>
        </li>
      </ul>
    </div>
  );
}

/** The rotated UI card that overlaps the right of the list on desktop. */
function StepCard({ stepId }: { stepId: string }) {
  return (
    <div className="mk-float-panel rotate-[4deg] rounded-[var(--mk-r-card)] bg-[var(--mk-surface)] p-6 text-[var(--mk-ink)]">
      <div className="mk-step-swap">
        <StepVisual stepId={stepId} />
      </div>
    </div>
  );
}

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const activeStep = HOW_IT_WORKS.steps[active] ?? HOW_IT_WORKS.steps[0];
  const listRef = useRef<HTMLDivElement>(null);
  // The desktop preview only appears once the list is scrolled into view, or
  // when the visitor interacts with a row.
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = listRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setInView(entry.isIntersecting);
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Mobile and tablet have no hover, so the active step follows the scroll
  // position: the orange banner moves as each row crosses the focus line and
  // the widget below the list swaps to match.
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof window.matchMedia !== 'function') return;
    const mobile = window.matchMedia('(max-width: 1023px)');
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!mobile.matches) return;
      const listRect = list.getBoundingClientRect();
      if (listRect.bottom < 0 || listRect.top > window.innerHeight) return;
      const rows = Array.from(list.querySelectorAll('ol > li'));
      if (!rows.length) return;
      const focusLine = window.innerHeight * 0.42;
      let next = 0;
      rows.forEach((row, index) => {
        if (row.getBoundingClientRect().top <= focusLine) next = index;
      });
      setActive((current) => (current === next ? current : next));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    mobile.addEventListener?.('change', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      mobile.removeEventListener?.('change', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <Section
      id="how-it-works"
      className="mk-ref !max-w-none !px-0"
      tone="ink"
      innerClassName="p-6 md:p-10 lg:p-16"
      contentClassName="mx-auto w-full max-w-[1360px]"
    >
      <Reveal>
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
        <div className="lg:col-span-8">
          <h2 className="mk-h2 max-w-[22ch] text-balance text-white">
            {HOW_IT_WORKS.headlineBefore}
            <ProductChip>{HOW_IT_WORKS.headlineChip}</ProductChip>
            {HOW_IT_WORKS.headlineAfter}
          </h2>
        </div>
        <p className="mk-body-lg max-w-[42ch] text-white/70 lg:col-span-4">
          {HOW_IT_WORKS.intro}
        </p>
      </div>

      <div ref={listRef} className="relative mt-10">
        <ol className="relative z-10">
          {HOW_IT_WORKS.steps.map((step, index) => {
            const isActive = index === active;
            return (
              <li
                key={step.id}
                className="border-b border-[var(--mk-line-dark)] first:border-t"
              >
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onClick={() => setActive(index)}
                  aria-expanded={isActive}
                  className={cn(
                    'w-full rounded-[var(--mk-r-card)] text-left transition-[background-color,color,box-shadow] duration-[var(--mk-dur-base)] ease-[var(--mk-ease)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--mk-accent)]',
                    isActive
                      ? 'bg-[var(--mk-accent)] text-[var(--mk-accent-ink)]'
                      : 'text-white/85 hover:bg-white/5',
                  )}
                >
                  <span className="flex min-h-[64px] items-center justify-between gap-4 px-5 py-3">
                    <span className="flex min-h-0 flex-col gap-1 lg:max-w-[52%]">
                      <span className="mk-h3 text-[19px]">{step.title}</span>
                      <span
                        className={cn(
                          'mk-small',
                          isActive ? 'text-white' : 'text-white/55',
                        )}
                      >
                        {step.description}
                      </span>
                      {isActive ? (
                        <span className="mk-step-swap mt-1 flex flex-wrap gap-1.5">
                          {step.chips.map((chip) => (
                            <TagPill key={chip} tone="onAccent">
                              {chip}
                            </TagPill>
                          ))}
                        </span>
                      ) : null}
                    </span>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="h-5 w-5 shrink-0"
                      strokeWidth={1.5}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* Mobile/tablet: one widget follows the active step so scrolling does
            not shift the rows (no accordion feedback loop). */}
        <div className="mt-4 lg:hidden">
          <div
            key={activeStep.id}
            className="mk-step-swap rounded-[var(--mk-r-card)] bg-[var(--mk-surface)] p-5 text-[var(--mk-ink)]"
          >
            <StepVisual stepId={activeStep.id} />
          </div>
        </div>

        {/* Desktop: rotated card overlapping the list (reference block 3). */}
        <div
          className={cn(
            'pointer-events-none absolute right-[10%] top-[8%] z-20 hidden w-[30%] max-w-[320px] transition-[opacity,transform] duration-[var(--mk-dur-slow)] ease-[var(--mk-ease)] motion-reduce:transition-none lg:block',
            inView ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
          )}
        >
          <StepCard key={activeStep.id} stepId={activeStep.id} />
        </div>
        </div>
      </Reveal>
    </Section>
  );
}
