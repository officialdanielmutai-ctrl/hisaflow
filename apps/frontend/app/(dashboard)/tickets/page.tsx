'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';
import Link from 'next/link';
import { TicketCheck, Plus, X, User, Phone, CheckCircle2, RotateCcw, AlertCircle, Clock } from 'lucide-react';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import {
  getTickets,
  createTicket,
  startTicket,
  resolveTicket,
  closeTicket,
  reopenTicket,
  getSubscribers,
  type Ticket,
  type TicketStatus,
  type Subscriber,
} from '@/services/isp.service';

const STATUS_STYLES: Record<TicketStatus, string> = {
  OPEN: 'bg-red-100 text-red-700 border border-red-200',
  IN_PROGRESS: 'bg-amber-100 text-amber-700 border border-amber-200',
  RESOLVED: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  CLOSED: 'bg-gray-100 text-gray-500 border border-gray-200',
};

type FilterStatus = 'ALL' | TicketStatus;

export default function TicketsPage() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const orgId = membership?.organization?.id ?? '';

  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    subscriberId: '',
    subject: '',
    description: '',
  });

  const { data: tickets = [], isLoading, mutate } = useSWR(
    orgId ? ['tickets', orgId, filter] : null,
    async () => {
      const token = await getToken();
      if (!token) return [];
      return getTickets(token, orgId, filter === 'ALL' ? undefined : filter);
    },
  );

  const { data: subscribers = [] } = useSWR(
    orgId ? ['subscribers-list-for-tickets', orgId] : null,
    async () => {
      const token = await getToken();
      if (!token) return [];
      return getSubscribers(token, orgId);
    },
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) return;
      await createTicket(token, orgId, {
        subscriberId: form.subscriberId,
        subject: form.subject,
        description: form.description || undefined,
      });
      await mutate();
      setShowModal(false);
      setForm({ subscriberId: '', subject: '', description: '' });
    } catch (err: any) {
      setError(err.message || 'Failed to create ticket');
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (id: string, action: 'start' | 'resolve' | 'close' | 'reopen') => {
    try {
      const token = await getToken();
      if (!token) return;
      if (action === 'start') await startTicket(token, orgId, id);
      if (action === 'resolve') await resolveTicket(token, orgId, id);
      if (action === 'close') await closeTicket(token, orgId, id);
      if (action === 'reopen') await reopenTicket(token, orgId, id);
      await mutate();
    } catch (err: any) {
      alert(err.message || `Failed to ${action} ticket`);
    }
  };

  const FILTER_TABS: { label: string; value: FilterStatus }[] = [
    { label: 'All', value: 'ALL' },
    { label: 'Open', value: 'OPEN' },
    { label: 'In Progress', value: 'IN_PROGRESS' },
    { label: 'Resolved', value: 'RESOLVED' },
    { label: 'Closed', value: 'CLOSED' },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <TicketCheck className="h-5 w-5 text-[var(--color-accent)]" />
          <h1 className="text-lg font-semibold">Support Tickets</h1>
          {tickets.length > 0 && (
            <span className="ml-1 text-sm text-[var(--color-text-secondary)]">({tickets.length})</span>
          )}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          New Ticket
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {FILTER_TABS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
              filter === value
                ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-accent)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--color-bg-surface)]" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] p-12 text-center">
          <TicketCheck className="h-10 w-10 text-[var(--color-text-secondary)] mb-3 opacity-40" />
          <p className="font-medium">No tickets recorded</p>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1 mb-4">
            Customer service issues and connectivity complaints will appear here.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Log First Ticket
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket: Ticket) => (
            <div
              key={ticket.id}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base">{ticket.subject}</span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${STATUS_STYLES[ticket.status]}`}>
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </div>
                  <Link
                    href={`/subscribers/${ticket.subscriberId}`}
                    className="text-xs text-[var(--color-accent)] font-medium hover:underline mt-0.5 inline-block"
                  >
                    Subscriber: {ticket.subscriber?.name} ({ticket.subscriber?.phone})
                  </Link>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {ticket.status === 'OPEN' && (
                    <button
                      onClick={() => handleStatus(ticket.id, 'start')}
                      className="rounded-xl bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 text-xs font-semibold hover:bg-amber-100"
                    >
                      In Progress
                    </button>
                  )}
                  {ticket.status === 'IN_PROGRESS' && (
                    <button
                      onClick={() => handleStatus(ticket.id, 'resolve')}
                      className="flex items-center gap-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-100"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                    </button>
                  )}
                  {ticket.status === 'RESOLVED' && (
                    <>
                      <button
                        onClick={() => handleStatus(ticket.id, 'close')}
                        className="rounded-xl bg-gray-100 text-gray-700 border border-gray-200 px-3 py-1.5 text-xs font-semibold hover:bg-gray-200"
                      >
                        Close
                      </button>
                      <button
                        onClick={() => handleStatus(ticket.id, 'reopen')}
                        className="flex items-center gap-1 rounded-xl border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                      >
                        <RotateCcw className="h-3 w-3" /> Reopen
                      </button>
                    </>
                  )}
                </div>
              </div>

              {ticket.description && (
                <p className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg-base)] border border-[var(--color-border)] p-2.5 rounded-xl my-2">
                  {ticket.description}
                </p>
              )}

              <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] mt-3 pt-2 border-t border-[var(--color-border)]">
                <span>
                  Logged {new Date(ticket.createdAt).toLocaleDateString('en-KE', { dateStyle: 'medium' })}
                </span>
                {ticket.resolvedAt && (
                  <span className="text-emerald-600 font-medium">
                    Resolved {new Date(ticket.resolvedAt).toLocaleDateString('en-KE', { dateStyle: 'medium' })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base">New Support Ticket</h2>
              <button onClick={() => setShowModal(false)} className="text-[var(--color-text-secondary)] hover:text-red-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Subscriber *</label>
                <select
                  required
                  value={form.subscriberId}
                  onChange={(e) => setForm((f) => ({ ...f, subscriberId: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                >
                  <option value="">Select a subscriber...</option>
                  {subscribers.map((s: Subscriber) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Subject *</label>
                <input
                  required
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                  placeholder="e.g. No Internet connection / LOS red light"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Issue Details</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] resize-none"
                  placeholder="e.g. Customer restarted router twice. Fiber cable may be bent near gate."
                />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90 transition-opacity"
              >
                {saving ? 'Logging…' : 'Log Ticket'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
