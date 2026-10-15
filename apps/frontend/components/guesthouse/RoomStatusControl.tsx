'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';
import { useSWRConfig } from 'swr';
import {
  BedDouble,
  Check,
  CheckCircle2,
  Loader2,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { useRole } from '@/hooks/useRole';
import {
  roomsService,
  type Room,
  type RoomIssue,
  type RoomStatus,
} from '@/services/rooms.service';
import { ROOM_STATUS_LABELS } from '@/lib/room-status';
import { ReportRoomIssueSheet } from '@/components/guesthouse/ReportRoomIssueSheet';

const QUICK_STATUSES: {
  value: Exclude<RoomStatus, 'OUT_OF_ORDER'>;
  label: string;
  icon: typeof Check;
}[] = [
  { value: 'VACANT_CLEAN', label: 'Clean', icon: Sparkles },
  { value: 'VACANT_DIRTY', label: 'Dirty', icon: BedDouble },
  { value: 'OCCUPIED', label: 'Occupied', icon: CheckCircle2 },
  { value: 'MAINTENANCE', label: 'Maintenance', icon: Wrench },
];

function formatMoney(currency: string | undefined, value: number) {
  return `${currency ?? 'KES'} ${value.toLocaleString()}`;
}

/**
 * Lets a user change a room's housekeeping state and report/resolve faults.
 * Quick statuses PATCH the room; OUT_OF_ORDER goes through fault reporting so
 * the mandatory note and repair cost are always captured.
 */
export function RoomStatusControl({ room }: { room: Room }) {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const { isOwner, isManager } = useRole();
  const { mutate } = useSWRConfig();

  const [saving, setSaving] = useState<RoomStatus | null>(null);
  const [error, setError] = useState('');
  const [showIssueSheet, setShowIssueSheet] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);

  const currency = membership?.organization?.currency;

  const { data: issues = [], mutate: reloadIssues } = useSWR<RoomIssue[]>(
    membership ? `room-issues-${room.id}` : null,
    async () => {
      const token = await getToken();
      if (!token || !membership) throw new Error('Not authenticated');
      return roomsService.getIssues(room.id, token, membership.organization.id);
    },
  );

  const openIssues = issues.filter((issue) => issue.status === 'OPEN');
  // Staff may report faults (the note is written by the reporter) but only
  // owners/managers can set housekeeping states or resolve faults.
  const canManage = isOwner || isManager;

  const setStatus = async (status: RoomStatus) => {
    if (!membership) return;
    setSaving(status);
    setError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await roomsService.update(room.id, { status }, token, membership.organization.id);
      mutate('rooms-list');
      mutate(`room-${room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the room status');
    } finally {
      setSaving(null);
    }
  };

  const resolveIssue = async (issueId: string) => {
    if (!membership) return;
    setResolving(issueId);
    setError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await roomsService.resolveIssue(issueId, token, membership.organization.id);
      mutate('rooms-list');
      mutate(`room-${room.id}`);
      reloadIssues();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resolve the fault');
    } finally {
      setResolving(null);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Room status</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Currently <strong>{ROOM_STATUS_LABELS[room.status]}</strong>
          </p>
        </div>
        <button
          onClick={() => setShowIssueSheet(true)}
          className="flex items-center gap-1.5 rounded-xl bg-[var(--color-status-critical)]/10 px-3 py-2 text-xs font-semibold text-[var(--color-status-critical)] transition-colors hover:bg-[var(--color-status-critical)]/20"
        >
          <Wrench className="h-3.5 w-3.5" />
          Report fault
        </button>
      </div>

      {canManage && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {QUICK_STATUSES.map((option) => {
          const Icon = option.icon;
          const active = room.status === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setStatus(option.value)}
                disabled={saving !== null}
                aria-pressed={active}
                className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                  active
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]'
                }`}
              >
                {saving === option.value ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

      {openIssues.length > 0 && (
        <div className="mt-5 border-t border-[var(--color-border)] pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Open faults ({openIssues.length})
          </p>
          <div className="flex flex-col gap-2">
            {openIssues.map((issue) => (
              <div
                key={issue.id}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {issue.description}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                      {issue.category.toLowerCase()}
                      {issue.cost != null && ` · ${formatMoney(currency, Number(issue.cost))}`}
                      {issue.reportedByName && ` · by ${issue.reportedByName}`}
                    </p>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => resolveIssue(issue.id)}
                      disabled={resolving === issue.id}
                      className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {resolving === issue.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {issues.some((issue) => issue.status === 'RESOLVED') && (
        <div className="mt-4 border-t border-[var(--color-border)] pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Resolved
          </p>
          <div className="flex flex-col gap-1.5">
            {issues
              .filter((issue) => issue.status === 'RESOLVED')
              .slice(0, 5)
              .map((issue) => (
                <p key={issue.id} className="text-xs text-[var(--color-text-muted)]">
                  ✓ {issue.description}
                  {issue.cost != null && ` · ${formatMoney(currency, Number(issue.cost))}`}
                </p>
              ))}
          </div>
        </div>
      )}

      <ReportRoomIssueSheet
        room={room}
        isOpen={showIssueSheet}
        onClose={() => setShowIssueSheet(false)}
      />
    </div>
  );
}
