import Link from 'next/link';
import type { ReactNode } from 'react';
import { Section } from './Section';
import { Footer } from './sections/Footer';

interface LegalShellProps {
  title: string;
  updated: string;
  children: ReactNode;
}

/**
 * Minimal shell for the public legal pages. They use the same canvas, type
 * scale and footer as the landing page so the surface feels continuous
 * (`hisaflow-landing-visual-spec.md` Section 5.1).
 */
export function LegalShell({ title, updated, children }: LegalShellProps) {
  return (
    <div className="mk-stack pb-3 md:pb-4">
      <Section innerClassName="px-6 py-12 md:px-10 md:py-16">
        <Link
          href="/"
          className="mk-small inline-flex items-center gap-2 font-semibold text-[var(--mk-ink-2)] transition-colors hover:text-[var(--mk-ink)]"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-[var(--mk-r-sm)] bg-[var(--mk-accent)] text-sm font-extrabold text-[var(--mk-accent-ink)]">
            H
          </span>
          HisaFlow
        </Link>
        <h1 className="mk-h2 mt-8 text-balance">{title}</h1>
        <p className="mk-small mt-3 text-[var(--mk-ink-3)]">
          Last updated {updated}
        </p>
        <div className="mk-prose mt-10 max-w-[68ch]">
          {children}
        </div>
      </Section>
      <Footer />
    </div>
  );
}
