'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { useSWRConfig } from 'swr';
import { AlertTriangle, Loader2, Wrench, X } from 'lucide-react';
import { roomsService, type Room } from '@/services/rooms.service';
import {
  ROOM_ISSUE_CATEGORY_OPTIONS,
  roomIssuePayload,
  validateRoomIssue,
  type RoomIssueFormErrors,
  type RoomIssueFormValues,
} from '@/lib/room-issues';

interface ReportRoomIssueSheetProps {
  room: Room;
  isOpen: boolean;
  onClose: () => void;
}

const EMPTY: RoomIssueFormValues = { description: '', category: 'REPAIR', cost: '' };

/**
 * Report a room fault. The note is mandatory (the reporter must say what
 * broke); the repair cost is optional. Submitting marks the room OUT_OF_ORDER.
 */
export function ReportRoomIssueSheet({ room, isOpen, onClose }: ReportRoomIssueSheetProps) {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const { mutate } = useSWRConfig();

  const [values, setValues] = useState<RoomIssueFormValues>(EMPTY);
  const [errors, setErrors] = useState<RoomIssueFormErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setValues(EMPTY);
      setErrors({});
      setSubmitError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!membership) return;

    const validation = validateRoomIssue(values);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setLoading(true);
    setSubmitError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await roomsService.reportIssue(room.id, roomIssuePayload(values), token, membership.organization.id);
      mutate('rooms-list');
      mutate(`room-${room.id}`);
      mutate(`room-issues-${room.id}`);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to report the fault');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-md flex-col bg-[var(--color-bg-base)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div className="flex items-center gap-2 text-[var(--color-status-critical)]">
            <Wrench className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Report a fault</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-elevated)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-50/60 p-3 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Reporting a fault takes <strong>{room.name}</strong> out of service until it is
              resolved.
            </p>
          </div>

          <form id="room-issue-form" onSubmit={handleSubmit} className="space-y-6">
            {submitError && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                {submitError}
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
                What broke? <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={values.description}
                onChange={(e) => setValues({ ...values, description: e.target.value })}
                placeholder="e.g. Shower is leaking and the floor is wet"
                className={`w-full resize-none rounded-xl border bg-[var(--color-bg-surface)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] ${
                  errors.description ? 'border-red-400' : 'border-[var(--color-border)]'
                }`}
              />
              {errors.description && (
                <p className="mt-1 text-xs text-red-500">{errors.description}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
                Category
              </label>
              <select
                value={values.category}
                onChange={(e) => setValues({ ...values, category: e.target.value })}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              >
                {ROOM_ISSUE_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.emoji} {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
                Repair cost (optional)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-medium text-[var(--color-text-muted)]">
                  {membership?.organization?.currency || 'KES'}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={values.cost}
                  onChange={(e) => setValues({ ...values, cost: e.target.value })}
                  placeholder="0"
                  className={`w-full rounded-xl border bg-[var(--color-bg-surface)] py-2.5 pl-14 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] ${
                    errors.cost ? 'border-red-400' : 'border-[var(--color-border)]'
                  }`}
                />
              </div>
              {errors.cost && <p className="mt-1 text-xs text-red-500">{errors.cost}</p>}
            </div>
          </form>
        </div>

        <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6">
          <button
            type="submit"
            form="room-issue-form"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-xl bg-[var(--color-status-critical)] px-4 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Report fault & take room offline'}
          </button>
        </div>
      </div>
    </div>
  );
}
