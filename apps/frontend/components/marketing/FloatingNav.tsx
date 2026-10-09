'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, MessageCircle, X } from 'lucide-react';
import { NAV_LINKS } from '@/features/marketing/config/content';
import { signInHref, signUpHref, whatsappHref } from '@/features/marketing/config/site';
import { ButtonLink } from './Button';
import { cn } from '@/lib/utils';

function Wordmark() {
  return (
    <Link
      href="#top"
      className="inline-flex items-center gap-2 rounded-[var(--mk-r-pill)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--mk-accent)] focus-visible:ring-offset-2"
      aria-label="HisaFlow home"
    >
      <span className="flex h-8 w-8 items-center justify-center">
        <Image
          src="/icons/hisaflow-mark.png"
          alt=""
          width={30}
          height={30}
          priority
          className="h-[30px] w-[30px] object-contain"
        />
      </span>
      <span className="text-[17px] font-extrabold tracking-tight text-[var(--mk-ink)]">
        HisaFlow
      </span>
    </Link>
  );
}

export function FloatingNav() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wa = whatsappHref('general');

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('a,button')?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <header className="sticky top-3 z-40 md:top-4">
      <nav aria-label="Primary" className="mk-shell">
        <div className="flex h-[52px] items-center justify-between gap-3 rounded-[var(--mk-r-pill)] border border-[var(--mk-line)] bg-[var(--mk-surface)] px-3 shadow-[var(--mk-e1)] md:h-14 md:px-4">
          <Wordmark />

          <ul className="hidden items-center gap-7 md:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="group relative text-sm font-medium text-[var(--mk-ink-2)] transition-colors hover:text-[var(--mk-ink)]"
                >
                  {link.label}
                  <span className="absolute -bottom-1 left-0 h-0.5 w-0 rounded-[var(--mk-r-pill)] bg-[var(--mk-accent)] transition-all duration-[var(--mk-dur-fast)] ease-[var(--mk-ease)] group-hover:w-full" />
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-2 md:flex">
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Chat on WhatsApp"
                className="flex h-11 w-11 items-center justify-center rounded-[var(--mk-r-pill)] text-[var(--mk-ink-2)] transition-colors hover:bg-[var(--color-bg-elevated)] hover:text-[var(--mk-ink)]"
              >
                <MessageCircle className="h-5 w-5" strokeWidth={1.5} />
              </a>
            ) : null}
            <Link
              href={signInHref()}
              className="rounded-[var(--mk-r-pill)] px-3 py-2 text-sm font-medium text-[var(--mk-ink-2)] transition-colors hover:text-[var(--mk-ink)]"
            >
              Sign in
            </Link>
            <ButtonLink href={signUpHref()} size="md" variant="primary" withArrow>
              Start free trial
            </ButtonLink>
          </div>

          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="marketing-mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="flex h-11 w-11 items-center justify-center rounded-[var(--mk-r-pill)] border border-[var(--mk-line)] text-[var(--mk-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--mk-accent)] md:hidden"
          >
            {open ? (
              <X className="h-5 w-5" strokeWidth={1.5} />
            ) : (
              <Menu className="h-5 w-5" strokeWidth={1.5} />
            )}
          </button>
        </div>

        <div
          id="marketing-mobile-menu"
          ref={panelRef}
          hidden={!open}
          className={cn(
            'mt-3 rounded-[var(--mk-r-section)] border border-[var(--mk-line)] bg-[var(--mk-surface)] p-3 shadow-[var(--mk-e2)] md:hidden',
          )}
        >
          <ul className="flex flex-col">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-[52px] items-center rounded-[var(--mk-r-inner)] px-4 text-base font-medium text-[var(--mk-ink)] hover:bg-[var(--color-bg-elevated)]"
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <Link
                href={signInHref()}
                onClick={() => setOpen(false)}
                className="flex min-h-[52px] items-center rounded-[var(--mk-r-inner)] px-4 text-base font-medium text-[var(--mk-ink)] hover:bg-[var(--color-bg-elevated)]"
              >
                Sign in
              </Link>
            </li>
            {wa ? (
              <li>
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex min-h-[52px] items-center gap-3 rounded-[var(--mk-r-inner)] px-4 text-base font-medium text-[var(--mk-ink)] hover:bg-[var(--color-bg-elevated)]"
                >
                  <MessageCircle className="h-5 w-5" strokeWidth={1.5} />
                  Chat on WhatsApp
                </a>
              </li>
            ) : null}
          </ul>
          <div className="mt-3">
            <ButtonLink
              href={signUpHref()}
              size="lg"
              variant="primary"
              withArrow
              className="w-full"
            >
              Start free trial
            </ButtonLink>
          </div>
        </div>
      </nav>
    </header>
  );
}
