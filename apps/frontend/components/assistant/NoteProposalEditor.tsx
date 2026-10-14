'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, FileText, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AssistantProposal } from '@/services/assistant.service';
import {
  NOTE_IMPORTANCE,
  noteArgsFromDraft,
  noteDraftFromProposal,
  proposalStatusLabel,
  proposalStatusTone,
  type NoteDraft,
} from '@/lib/assistant';

export interface NoteProposalEditorProps {
  proposal: AssistantProposal;
  busy?: boolean;
  /** Human-readable outcome shown after the note is saved. */
  result?: string | null;
  /** Approve + execute the (possibly edited) note. */
  onSave: (id: string, args: Record<string, unknown>) => void;
  onDiscard?: (id: string) => void;
}

const INPUT_CLASS =
  'w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]';

/**
 * The "note panel" the assistant whips up when the user asks it to send or
 * save a note. It is a `create_note` proposal rendered as the same fields the
 * manual New Note form uses (title, details, importance, due date), prefilled
 * from the assistant's draft. The user reviews/edits, then saves — which is
 * the approve + execute step of the single governed write path.
 */
export function NoteProposalEditor({
  proposal,
  busy = false,
  result = null,
  onSave,
  onDiscard,
}: NoteProposalEditorProps) {
  const [draft, setDraft] = useState<NoteDraft>(() =>
    noteDraftFromProposal(proposal),
  );

  const isExecuted = proposal.status === 'EXECUTED';
  const isFailed = proposal.status === 'FAILED';
  const canSave = draft.title.trim().length > 0 && !busy && !isExecuted;

  const update = (patch: Partial<NoteDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  return (
    <div
      data-testid="note-proposal-panel"
      role="group"
      aria-label={`Note draft: ${draft.title || proposal.summary}`}
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-accent)] text-white">
          <FileText className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="text-sm font-bold text-[var(--color-text-primary)]">
          New note
        </span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
            proposalStatusTone(proposal.status),
          )}
        >
          {proposalStatusLabel(proposal.status)}
        </span>
        {proposal.version > 1 && (
          <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">
            v{proposal.version}
          </span>
        )}
      </div>

      {!isExecuted && (
        <p className="mb-3 text-[11px] font-semibold text-amber-700">
          Drafted by the assistant — review, edit if needed, then save. Nothing is
          saved until you press Save note.
        </p>
      )}

      {result && (
        <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
          {result}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            Title
          </span>
          <input
            type="text"
            className={INPUT_CLASS}
            value={draft.title}
            readOnly={isExecuted}
            placeholder="Note title"
            onChange={(event) => update({ title: event.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            Details
          </span>
          <textarea
            rows={3}
            className={INPUT_CLASS}
            value={draft.content}
            readOnly={isExecuted}
            placeholder="Any details…"
            onChange={(event) => update({ content: event.target.value })}
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
              Importance
            </span>
            <select
              className={cn(INPUT_CLASS, 'bg-white')}
              value={draft.importance}
              disabled={isExecuted}
              onChange={(event) =>
                update({ importance: event.target.value as NoteDraft['importance'] })
              }
            >
              {NOTE_IMPORTANCE.map((importance) => (
                <option key={importance} value={importance}>
                  {importance.charAt(0) + importance.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
              Due date
            </span>
            <input
              type="datetime-local"
              className={cn(INPUT_CLASS, 'bg-white')}
              value={draft.dueDate}
              readOnly={isExecuted}
              onChange={(event) => update({ dueDate: event.target.value })}
            />
          </label>
        </div>
      </div>

      {isExecuted ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-emerald-700">Saved.</span>
          <Link
            href="/notes"
            className="inline-flex min-h-[44px] items-center text-xs font-semibold text-[var(--color-accent)] hover:underline"
          >
            View in Notes →
          </Link>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSave(proposal.id, noteArgsFromDraft(draft))}
            disabled={!canSave}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {isFailed ? (
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Check className="h-4 w-4" aria-hidden="true" />
            )}
            {isFailed ? 'Retry' : busy ? 'Saving…' : 'Save note'}
          </button>
          {onDiscard && (
            <button
              type="button"
              onClick={() => onDiscard(proposal.id)}
              disabled={busy}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold text-red-600 disabled:opacity-50"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Discard
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default NoteProposalEditor;
