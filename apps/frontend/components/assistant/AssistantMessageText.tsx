'use client';

import {
  parseAssistantInline,
  parseAssistantMessage,
  type AssistantInlineSegment,
} from '@/lib/assistant';

function InlineText({ text }: { text: string }) {
  const segments: AssistantInlineSegment[] = parseAssistantInline(text);
  return (
    <>
      {segments.map((segment, index) => {
        if (segment.kind === 'strong') {
          return (
            <strong key={index} className="font-semibold">
              {segment.text}
            </strong>
          );
        }
        if (segment.kind === 'code') {
          // Deliberately unstyled: the model sometimes wraps product names or
          // amounts in backticks, and a code pill makes a normal answer look
          // like a developer dump.
          return <span key={index}>{segment.text}</span>;
        }
        return <span key={index}>{segment.text}</span>;
      })}
    </>
  );
}

/**
 * Renders an assistant reply as natural edited prose. The backend asks the
 * model for prose, but models still return light Markdown; this keeps bold and
 * lists while removing fenced blocks/backticks that made replies look like code.
 */
export function AssistantMessageText({ text }: { text: string }) {
  const blocks = parseAssistantMessage(text);
  if (blocks.length === 0) {
    return <p className="leading-relaxed">{text}</p>;
  }
  return (
    <div className="space-y-2 leading-relaxed">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <p key={index} className="font-semibold">
              <InlineText text={block.text} />
            </p>
          );
        }
        if (block.type === 'bullet') {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <InlineText text={item} />
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === 'numbered') {
          return (
            <ol key={index} className="list-decimal space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <InlineText text={item} />
                </li>
              ))}
            </ol>
          );
        }
        if (block.type === 'data') {
          return (
            <dl
              key={index}
              className="grid gap-1.5 rounded-xl bg-black/[0.035] px-3 py-2"
            >
              {block.rows.map((row, rowIndex) => (
                <div
                  key={`${row.label}-${rowIndex}`}
                  className="flex items-baseline justify-between gap-4"
                >
                  <dt className="text-xs text-[var(--color-text-secondary)]">
                    {row.label}
                  </dt>
                  <dd className="text-right text-xs font-semibold text-[var(--color-text-primary)]">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          );
        }
        return (
          <p key={index}>
            <InlineText text={block.text} />
          </p>
        );
      })}
    </div>
  );
}

export default AssistantMessageText;
