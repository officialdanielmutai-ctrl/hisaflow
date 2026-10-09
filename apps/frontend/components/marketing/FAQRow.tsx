'use client';

import { useId, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FAQRowProps {
  question: string;
  answer: string;
}

/** Hairline accordion row matching the list grammar (Section 4.16). */
export function FAQRow({ question, answer }: FAQRowProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="border-b border-[var(--mk-line)]">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-[64px] w-full items-center justify-between gap-4 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--mk-accent)] focus-visible:ring-offset-2"
        >
          <span className="mk-body font-semibold text-[var(--mk-ink)]">
            {question}
          </span>
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--mk-r-pill)] border border-[var(--mk-line)] text-[var(--mk-ink)]"
          >
            {open ? (
              <Minus className="h-4 w-4" strokeWidth={1.5} />
            ) : (
              <Plus className="h-4 w-4" strokeWidth={1.5} />
            )}
          </span>
        </button>
      </h3>
      <div
        id={panelId}
        className={cn(
          'grid overflow-hidden transition-[grid-template-rows] duration-[var(--mk-dur-base)] ease-[var(--mk-ease)]',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0">
          <p className="mk-small max-w-[60ch] pb-5 pr-12 text-[var(--mk-ink-2)]">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
}
