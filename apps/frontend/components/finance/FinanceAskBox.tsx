'use client';

import { useState } from 'react';
import { Loader2, Send, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { sendAssistantMessage } from '@/services/assistant.service';

const SUGGESTIONS = [
  'Where is my money leaking?',
  'Which room earns the most?',
  'What are my biggest expenses?',
  'How is my profit this month?',
];

interface AskMessage {
  role: 'user' | 'assistant';
  text: string;
}

/**
 * Inline "ask the assistant" box for Finance. It answers read-only questions
 * from live figures (the assistant's finance read tools); any change it would
 * make is proposed on the full Assistant page, never applied here.
 */
export function FinanceAskBox({
  orgId,
  getToken,
}: {
  orgId: string;
  getToken: () => Promise<string | null>;
}) {
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [hasProposals, setHasProposals] = useState(false);

  const ask = async (text: string) => {
    const question = text.trim();
    if (!question || loading) return;

    setMessages((current) => [...current, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const result = await sendAssistantMessage(question, token, orgId, conversationId);
      setConversationId(result.conversationId);
      if (result.proposals.length > 0) setHasProposals(true);
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: result.reply ?? 'I could not produce an answer. Try rephrasing the question.',
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: 'I could not reach the assistant. Check your connection and try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            Ask about your finances
          </p>
          <p className="text-[11px] text-[var(--color-text-secondary)]">
            Answers come from your own figures.
          </p>
        </div>
      </div>

      {messages.length === 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => ask(suggestion)}
              disabled={loading}
              className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-elevated)] disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div className="mb-3 flex max-h-72 flex-col gap-2 overflow-y-auto" aria-live="polite">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
                message.role === 'user'
                  ? 'ml-auto bg-[var(--color-accent)] text-[var(--color-accent-foreground)]'
                  : 'bg-[var(--color-bg-base)] text-[var(--color-text-primary)]'
              }`}
            >
              {message.text}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking your figures…
            </div>
          )}
        </div>
      )}

      {hasProposals && (
        <div className="mb-3 rounded-xl border border-amber-400/40 bg-amber-50/60 px-3 py-2 text-xs text-amber-700">
          The assistant drafted a change.{' '}
          <Link href="/assistant" className="font-semibold underline">
            Review it in Assistant
          </Link>{' '}
          before it is applied.
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          ask(input);
        }}
        className="flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask a question about your business…"
          className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send question"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-foreground)] transition-opacity disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}
