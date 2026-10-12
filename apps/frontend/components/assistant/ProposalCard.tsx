'use client';

import { useState } from 'react';
import { Check, Pencil, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  AssistantProposal,
  AssistantProposalStatus,
} from '@/services/assistant.service';
import {
  coerceField,
  displayValue,
  extractDiffRows,
  isEditableScalar,
  proposalStatusLabel,
  proposalStatusTone,
  riskLabel,
  toolLabel,
} from '@/lib/assistant';

export interface ProposalCardProps {
  proposal: AssistantProposal;
  busy?: boolean;
  /** Human-readable outcome shown after a successful apply. */
  result?: string | null;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onExecute?: (id: string) => void;
  onEdit?: (id: string, args: Record<string, unknown>) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function initialDrafts(args: Record<string, unknown>): {
  scalars: Record<string, string>;
  updates: Record<string, string>;
} {
  const scalars: Record<string, string> = {};
  const updates: Record<string, string> = {};
  for (const [key, value] of Object.entries(args)) {
    if (key === 'updates' && isRecord(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        updates[nestedKey] = displayValue(nestedValue);
      }
    } else if (isEditableScalar(value)) {
      scalars[key] = value === null || value === undefined ? '' : String(value);
    }
  }
  return { scalars, updates };
}

const INPUT_CLASS =
  'w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]';

export function ProposalCard({
  proposal,
  busy = false,
  result = null,
  onApprove,
  onReject,
  onExecute,
  onEdit,
}: ProposalCardProps) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const initial = initialDrafts(proposal.args);
  const [scalars, setScalars] = useState<Record<string, string>>(initial.scalars);
  const [updates, setUpdates] = useState<Record<string, string>>(initial.updates);
  const [error, setError] = useState<string | null>(null);

  const isHighRisk = proposal.riskLevel === 'high';
  const diffRows = extractDiffRows(proposal.diff);

  const runGuarded = (action?: (id: string) => void) => {
    if (!action) return;
    if (isHighRisk && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    action(proposal.id);
  };

  const saveEdit = () => {
    if (!onEdit) return;
    const nextArgs: Record<string, unknown> = {};
    for (const [key, original] of Object.entries(proposal.args)) {
      if (key === 'updates' && isRecord(original)) {
        const nextUpdates: Record<string, unknown> = {};
        for (const [nestedKey, nestedValue] of Object.entries(original)) {
          nextUpdates[nestedKey] = coerceField(
            updates[nestedKey] ?? displayValue(nestedValue),
            nestedValue,
          );
        }
        nextArgs.updates = nextUpdates;
      } else if (isEditableScalar(original)) {
        nextArgs[key] = coerceField(scalars[key] ?? '', original);
      } else {
        nextArgs[key] = original;
      }
    }
    setError(null);
    onEdit(proposal.id, nextArgs);
    setEditing(false);
  };

  const statusBadge = (status: AssistantProposalStatus) => (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        proposalStatusTone(status),
      )}
    >
      {proposalStatusLabel(status)}
    </span>
  );

  return (
    <div
      data-testid="proposal-card"
      data-proposal-status={proposal.status}
      role="group"
      aria-label={`${toolLabel(proposal.tool)} proposal: ${proposal.summary}`}
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-[var(--color-text-primary)]">
          {toolLabel(proposal.tool)}
        </span>
        {statusBadge(proposal.status)}
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-semibold',
            isHighRisk
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]',
          )}
        >
          {riskLabel(proposal.riskLevel)}
        </span>
        {proposal.version > 1 && (
          <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">
            v{proposal.version}
          </span>
        )}
      </div>

      <p className="text-sm text-[var(--color-text-primary)]">{proposal.summary}</p>

      {(proposal.status === 'PROPOSED' || proposal.status === 'APPROVED') && (
        <p className="mt-1 text-[11px] font-semibold text-amber-700">
          Proposed — not applied until you approve and apply it.
        </p>
      )}

      {diffRows.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
          <div className="grid grid-cols-3 bg-[var(--color-bg-elevated)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
            <span>Field</span>
            <span>Before</span>
            <span>After</span>
          </div>
          {diffRows.map((row) => (
            <div
              key={row.field}
              data-testid="proposal-diff-row"
              className="grid grid-cols-3 border-t border-[var(--color-border)] px-3 py-1.5 text-xs"
            >
              <span className="font-semibold text-[var(--color-text-secondary)]">
                {row.field}
              </span>
              <span className="text-[var(--color-text-muted)]">{row.before}</span>
              <span className="font-semibold text-[var(--color-text-primary)]">
                {row.after}
              </span>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="mt-3 flex flex-col gap-2">
          {Object.entries(proposal.args).map(([key, value]) => {
            if (key === 'updates' && isRecord(value)) {
              return Object.keys(value).map((nestedKey) => (
                <label key={`updates.${nestedKey}`} className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                    updates.{nestedKey}
                  </span>
                  <input
                    className={INPUT_CLASS}
                    value={updates[nestedKey] ?? ''}
                    onChange={(e) =>
                      setUpdates((prev) => ({ ...prev, [nestedKey]: e.target.value }))
                    }
                  />
                </label>
              ));
            }
            if (!isEditableScalar(value)) return null;
            return (
              <label key={key} className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                  {key}
                </span>
                <input
                  className={INPUT_CLASS}
                  value={scalars[key] ?? ''}
                  onChange={(e) =>
                    setScalars((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                />
              </label>
            );
          })}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveEdit}
              disabled={busy}
              className="min-h-[44px] flex-1 rounded-xl bg-[var(--color-accent)] px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="min-h-[44px] rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-text-secondary)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
          {result}
        </p>
      )}

      {proposal.status === 'EXECUTED' && !result && (
        <p className="mt-3 text-xs font-semibold text-emerald-700">Applied.</p>
      )}

      {proposal.status === 'EXECUTED' && (
        <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
          Undo is not available for this action.
        </p>
      )}

      {proposal.status === 'FAILED' && (
        <p className="mt-3 text-xs font-semibold text-red-700">
          This action failed. You can retry it.
        </p>
      )}

      {!editing && (
        <div className="mt-3 flex flex-wrap gap-2">
          {proposal.status === 'PROPOSED' && (
            <button
              type="button"
              onClick={() => runGuarded(onApprove)}
              disabled={busy}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              {isHighRisk && confirming ? 'Tap again to approve' : 'Approve'}
            </button>
          )}
          {proposal.status === 'APPROVED' && (
            <button
              type="button"
              onClick={() => runGuarded(onExecute)}
              disabled={busy}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              {isHighRisk && confirming ? 'Tap again to apply' : 'Apply'}
            </button>
          )}
          {proposal.status === 'FAILED' && (
            <button
              type="button"
              onClick={() => runGuarded(onExecute)}
              disabled={busy}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Retry
            </button>
          )}
          {(proposal.status === 'PROPOSED' || proposal.status === 'APPROVED') && (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                disabled={busy}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-text-primary)] disabled:opacity-50"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => runGuarded(onReject)}
                disabled={busy}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold text-red-600 disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Reject
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default ProposalCard;
