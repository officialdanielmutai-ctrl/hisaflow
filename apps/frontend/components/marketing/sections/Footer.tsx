import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { FOOTER } from '@/features/marketing/config/content';
import { SITE, whatsappHref } from '@/features/marketing/config/site';
import { Section } from '../Section';

export function Footer() {
  const wa = whatsappHref('general');
  const year = new Date().getFullYear();

  return (
    <Section
      as="footer"
      tone="ink"
      className="!max-w-none !px-0"
      innerClassName="mk-mesh-footer !rounded-none"
      contentClassName="mx-auto w-full max-w-[1360px] px-6 py-12 md:px-10 md:py-16"
    >
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {FOOTER.columns.map((column) => (
          <div key={column.title}>
            <p className="mk-eyebrow text-white/50">{column.title}</p>
            <ul className="mt-4 flex flex-col gap-3">
              {column.links.map((link) => (
                <li key={`${column.title}-${link.label}`}>
                  {link.href.startsWith('/') ? (
                    <Link
                      href={link.href}
                      className="mk-small text-white/70 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      className="mk-small text-white/70 transition-colors hover:text-white"
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-12 flex flex-col gap-4 border-t border-[var(--mk-line-dark)] pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="mk-small text-white/50">
          © {year} {SITE.company}. Built in Kenya.
        </p>
        <div className="flex flex-wrap items-center gap-5">
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="mk-small inline-flex items-center gap-2 text-white/70 transition-colors hover:text-white"
            >
              <MessageCircle className="h-4 w-4" strokeWidth={1.5} />
              WhatsApp
            </a>
          ) : null}
          {SITE.contactEmail ? (
            <a
              href={`mailto:${SITE.contactEmail}`}
              className="mk-small text-white/70 transition-colors hover:text-white"
            >
              {SITE.contactEmail}
            </a>
          ) : null}
        </div>
      </div>
    </Section>
  );
}
