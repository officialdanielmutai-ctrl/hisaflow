import { MessageCircle } from 'lucide-react';
import { FAQ as FAQ_CONTENT } from '@/features/marketing/config/content';
import { whatsappHref } from '@/features/marketing/config/site';
import { Section } from '../Section';
import { FAQRow } from '../FAQRow';
import { CircleButton } from '../CircleButton';
import { Reveal } from '../Reveal';

export function FAQ() {
  const wa = whatsappHref('support');

  return (
    <Section
      id="faq"
      className="!max-w-none !px-0"
      contentClassName="mx-auto w-full max-w-[1360px] p-6 md:p-10 lg:p-16"
    >
      <Reveal>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-5">
        <h2 className="mk-h2 max-w-[14ch] text-balance">
          {FAQ_CONTENT.headline}
        </h2>
        {wa ? (
          <div className="mt-7 flex items-center gap-3">
            <CircleButton variant="accent" label="Ask us on WhatsApp" href={wa}>
              <MessageCircle className="h-5 w-5" strokeWidth={1.5} />
            </CircleButton>
            <span className="mk-small font-medium text-[var(--mk-ink-2)]">
              {FAQ_CONTENT.whatsappNote}
            </span>
          </div>
        ) : (
          <p className="mk-small mt-7 text-[var(--mk-ink-2)]">
            {FAQ_CONTENT.whatsappNote}
          </p>
        )}
      </div>

      <div className="lg:col-span-7">
        {FAQ_CONTENT.items.map((item) => (
          <FAQRow
            key={item.question}
            question={item.question}
            answer={item.answer}
          />
        ))}
      </div>
        </div>
      </Reveal>
    </Section>
  );
}
