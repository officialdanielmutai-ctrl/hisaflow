'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@clerk/nextjs';
import { Send, Sparkles } from 'lucide-react';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { useRole } from '@/hooks/useRole';
import {
  approveAssistantProposal,
  executeAssistantProposal,
  getAssistantConversationMessages,
  getAssistantTools,
  getUnsupportedIntents,
  listAssistantProposals,
  rejectAssistantProposal,
  reviseAssistantProposal,
  sendAssistantMessage,
  type AssistantProposal,
} from '@/services/assistant.service';
import {
  isNoteProposal,
  noteArgsEqual,
  suggestionsForTools,
} from '@/lib/assistant';
import NoteProposalEditor from './NoteProposalEditor';
import ProposalCard from './ProposalCard';
import UnsupportedIntentsCard from './UnsupportedIntentsCard';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: number;
}

function mergeProposals(
  current: AssistantProposal[],
  incoming: AssistantProposal[],
): AssistantProposal[] {
  const map = new Map(current.map((proposal) => [proposal.id, proposal]));
  for (const proposal of incoming) map.set(proposal.id, proposal);
  return Array.from(map.values());
}

export function AssistantPanel() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const { isOwner, isManager } = useRole();
  const orgId = membership?.organization.id;
  const canReviewIntents = isOwner || isManager;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [proposals, setProposals] = useState<AssistantProposal[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: tools } = useSWR(
    orgId ? ['assistant-tools', orgId] : null,
    async () => {
      const token = await getToken();
      if (!token || !orgId) return [];
      return getAssistantTools(token, orgId);
    },
  );

  const { data: unsupportedIntents } = useSWR(
    orgId && canReviewIntents ? ['assistant-unsupported', orgId] : null,
    async () => {
      const token = await getToken();
      if (!token || !orgId) return [];
      return getUnsupportedIntents(token, orgId);
    },
  );

  useEffect(() => {
    if (!orgId) return;
    let active = true;
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const pending = await listAssistantProposals(token, orgId, 'PROPOSED');
        if (active) setProposals((current) => mergeProposals(current, pending));
      } catch {
        // Loading pending proposals is best-effort; the panel still works.
      }
    })();
    return () => {
      active = false;
    };
  }, [getToken, orgId]);

  // Restore the current thread's memory for this organization. The id is kept
  // per-org in localStorage; the server prunes old threads, so a stale id
  // simply starts a fresh thread on the next message.
  useEffect(() => {
    if (!orgId) {
      setConversationId(null);
      setMessages([]);
      return;
    }
    const stored =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(`hf:assistant:conversation:${orgId}`)
        : null;
    if (!stored) {
      setConversationId(null);
      setMessages([]);
      return;
    }
    let active = true;
    setLoadingHistory(true);
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const storedMessages = await getAssistantConversationMessages(
          token,
          orgId,
          stored,
        );
        if (!active) return;
        setConversationId(stored);
        setMessages(
          storedMessages.map((message) => ({
            id: message.id,
            role: message.role === 'assistant' ? 'assistant' : 'user',
            text: message.content,
            at: new Date(message.createdAt).getTime(),
          })),
        );
      } catch {
        // Best-effort: a missing/expired thread just starts fresh.
      } finally {
        if (active) setLoadingHistory(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [getToken, orgId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, proposals]);

  const appendMessage = (role: ChatMessage['role'], text: string) => {
    setMessages((current) => [
      ...current,
      { id: `${role}-${Date.now()}-${Math.random()}`, role, text, at: Date.now() },
    ]);
  };

  const handleSend = useCallback(
    async (rawText?: string) => {
      const text = (rawText ?? input).trim();
      if (!text || sending || !orgId) return;

      appendMessage('user', text);
      setInput('');
      setSending(true);
      setError(null);
      try {
        const token = await getToken();
        if (!token) throw new Error('Not authenticated');
        const result = await sendAssistantMessage(
          text,
          token,
          orgId,
          conversationId ?? undefined,
        );
        if (result.conversationId) {
          setConversationId(result.conversationId);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(
              `hf:assistant:conversation:${orgId}`,
              result.conversationId,
            );
          }
        }
        appendMessage(
          'assistant',
          result.reply ??
            (result.proposals.length > 0
              ? `I've prepared ${result.proposals.length} action${result.proposals.length > 1 ? 's' : ''} for your review below.`
              : 'I could not find an action for that.'),
        );
        if (result.proposals.length > 0) {
          setProposals((current) => mergeProposals(current, result.proposals));
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Something went wrong. Please try again.',
        );
      } finally {
        setSending(false);
        composerRef.current?.focus();
      }
    },
    [conversationId, getToken, input, orgId, sending],
  );

  const runProposalAction = async (
    id: string,
    action: 'approve' | 'reject' | 'execute',
  ) => {
    if (!orgId) return;
    setBusyId(id);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      if (action === 'approve') {
        const updated = await approveAssistantProposal(id, token, orgId);
        setProposals((current) => mergeProposals(current, [updated]));
      } else if (action === 'reject') {
        const updated = await rejectAssistantProposal(id, token, orgId);
        setProposals((current) => mergeProposals(current, [updated]));
      } else {
        const outcome = await executeAssistantProposal(id, token, orgId);
        const refreshed = await listAssistantProposals(token, orgId);
        setProposals((current) => mergeProposals(current, refreshed));
        setResults((current) => ({
          ...current,
          [id]: outcome.idempotent
            ? 'Already applied earlier.'
            : 'Applied successfully.',
        }));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'That action could not be completed.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleEdit = async (id: string, args: Record<string, unknown>) => {
    if (!orgId) return;
    setBusyId(id);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const revised = await reviseAssistantProposal(id, args, token, orgId);
      setProposals((current) => mergeProposals(current, [revised]));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the edit.');
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Save a drafted note: revise first if the user changed the fields, then
   * walk the same governed approve → execute path as any other proposal.
   */
  const handleSaveNote = async (
    id: string,
    args: Record<string, unknown>,
  ) => {
    if (!orgId) return;
    setBusyId(id);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const original = proposals.find((proposal) => proposal.id === id);
      let targetId = id;
      if (original && !noteArgsEqual(original.args, args)) {
        const revised = await reviseAssistantProposal(id, args, token, orgId);
        setProposals((current) => mergeProposals(current, [revised]));
        targetId = revised.id;
      }
      await approveAssistantProposal(targetId, token, orgId);
      const outcome = await executeAssistantProposal(targetId, token, orgId);
      const refreshed = await listAssistantProposals(token, orgId);
      setProposals((current) => mergeProposals(current, refreshed));
      const message = outcome.idempotent ? 'Note already saved.' : 'Note saved.';
      setResults((current) => ({
        ...current,
        [id]: message,
        [targetId]: message,
      }));
      appendMessage('assistant', 'Note saved. You can find it under Notes.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'The note could not be saved.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const startNewChat = () => {
    if (orgId && typeof window !== 'undefined') {
      window.localStorage.removeItem(`hf:assistant:conversation:${orgId}`);
    }
    setConversationId(null);
    setMessages([]);
    setError(null);
    composerRef.current?.focus();
  };

  const confirmAll = async () => {
    if (!orgId || pending.length === 0) return;
    setBusyId('all');
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const applied: Record<string, string> = {};
      for (const proposal of pending) {
        await approveAssistantProposal(proposal.id, token, orgId);
        await executeAssistantProposal(proposal.id, token, orgId);
        applied[proposal.id] = 'Applied successfully.';
      }
      const refreshed = await listAssistantProposals(token, orgId);
      setProposals(refreshed);
      setResults((current) => ({ ...current, ...applied }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Some actions could not be applied. Review them below.',
      );
      const token = await getToken();
      if (token) {
        const refreshed = await listAssistantProposals(token, orgId);
        setProposals(refreshed);
      }
    } finally {
      setBusyId(null);
    }
  };

  const pending = proposals.filter((proposal) => proposal.status === 'PROPOSED');
  const active = proposals.filter(
    (proposal) => proposal.status !== 'REJECTED' && proposal.status !== 'EXPIRED',
  );
  const suggestions = suggestionsForTools(tools ?? []);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-40">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-accent)] text-white">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-bold text-[var(--color-text-primary)]">
          Assistant
        </h1>
        <button
          type="button"
          onClick={startNewChat}
          disabled={sending}
          className="ml-auto min-h-[44px] rounded-xl border border-[var(--color-border)] px-3 text-xs font-semibold text-[var(--color-text-secondary)] disabled:opacity-50"
        >
          New chat
        </button>
      </div>

      {/* Message list */}
      <div
        ref={scrollRef}
        data-testid="assistant-messages"
        className="flex max-h-[52vh] flex-col gap-3 overflow-y-auto"
      >
        {messages.length === 0 && (
          <p className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 text-sm text-[var(--color-text-secondary)]">
            {loadingHistory
              ? 'Restoring your conversation…'
              : 'Ask about your stock, sales or customers. I can read your data and prepare changes for you to approve.'}
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === 'user'
                ? 'self-end rounded-2xl bg-[var(--color-accent)] px-4 py-2 text-sm text-white'
                : 'self-start rounded-2xl bg-[var(--color-bg-elevated)] px-4 py-2 text-sm text-[var(--color-text-primary)]'
            }
          >
            {message.text}
          </div>
        ))}
        {sending && (
          <div
            data-testid="assistant-activity"
            aria-live="polite"
            className="self-start rounded-full bg-[var(--color-bg-elevated)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]"
          >
            Working…
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-600">
          {error}
        </p>
      )}

      {/* Multi-action review */}
      {pending.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="text-sm font-bold text-amber-800">
            Review and confirm {pending.length} actions
          </span>
          <button
            type="button"
            onClick={() => void confirmAll()}
            disabled={busyId !== null}
            className="min-h-[44px] rounded-xl bg-[var(--color-accent)] px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {busyId === 'all' ? 'Applying…' : 'Confirm all'}
          </button>
        </div>
      )}

      {active.length > 0 && (
        <div className="flex flex-col gap-3">
          {active.map((proposal) =>
            isNoteProposal(proposal) ? (
              <NoteProposalEditor
                key={proposal.id}
                proposal={proposal}
                busy={busyId === proposal.id}
                result={results[proposal.id] ?? null}
                onSave={handleSaveNote}
                onDiscard={(id) => runProposalAction(id, 'reject')}
              />
            ) : (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                busy={busyId === proposal.id}
                result={results[proposal.id] ?? null}
                onApprove={(id) => runProposalAction(id, 'approve')}
                onReject={(id) => runProposalAction(id, 'reject')}
                onExecute={(id) => runProposalAction(id, 'execute')}
                onEdit={handleEdit}
              />
            ),
          )}
        </div>
      )}

      {/* Suggestion chips generated from available tools */}
      {canReviewIntents && unsupportedIntents && unsupportedIntents.length > 0 && (
        <UnsupportedIntentsCard intents={unsupportedIntents} />
      )}

      {suggestions.length > 0 && messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleSend(suggestion)}
              className="min-h-[44px] rounded-full border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 text-xs font-semibold text-[var(--color-text-primary)] hover:border-[var(--color-accent)]"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="fixed inset-x-0 bottom-20 z-20 mx-auto max-w-3xl px-4 pb-safe">
        <div className="flex items-end gap-2 rounded-2xl border border-[var(--color-border)] bg-white p-2 shadow-lg">
          <label htmlFor="assistant-input" className="sr-only">
            Message the assistant
          </label>
          <textarea
            id="assistant-input"
            ref={composerRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Ask or tell me what happened…"
            className="max-h-32 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || !input.trim()}
            aria-label="Send message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)] text-white disabled:opacity-50"
          >
            <Send className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default AssistantPanel;
