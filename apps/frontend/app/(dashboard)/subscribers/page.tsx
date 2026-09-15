'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';
import Link from 'next/link';
import { Users, Plus, Phone, MessageCircle, Wifi, X } from 'lucide-react';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import {
  getSubscribers,
  createSubscriber,
  getServicePlans,
  type Subscriber,
  type SubscriberStatus,
  type ConnectionType,
  type ServicePlan,
} from '@/services/isp.service';

const STATUS_STYLES: Record<SubscriberStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  SUSPENDED: 'bg-amber-100 text-amber-700 border border-amber-200',
  CHURNED: 'bg-red-100 text-red-500 border border-red-200',
};

const CONN_LABELS: Record<ConnectionType, string> = {
  PPPOE: 'PPPoE',
  HOTSPOT: 'Hotspot',
  STATIC_IP: 'Static IP',
};

function toWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return '254' + digits.slice(1);
  if (digits.startsWith('254')) return digits;
  return '254' + digits;
}

type FilterStatus = 'ALL' | SubscriberStatus;

export default function SubscribersPage() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const orgId = membership?.organization?.id ?? '';

  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setShowForm(true);
    }
  }, [searchParams]);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    connectionType: 'PPPOE' as ConnectionType,
    planId: '',
    notes: '',
  });

  const planIdParam = searchParams.get('planId') || undefined;

  const { data: servicePlans = [] } = useSWR<ServicePlan[]>(
    orgId ? ['service-plans', orgId, 'active'] : null,
    async () => {
      const token = await getToken();
      if (!token) return [];
      return getServicePlans(token, orgId, true);
    },
  );

  const { data: subscribers = [], isLoading, mutate } = useSWR(
    orgId ? ['subscribers', orgId, filter, planIdParam] : null,
    async () => {
      const token = await getToken();
      if (!token) return [];
      return getSubscribers(token, orgId, filter === 'ALL' ? undefined : filter, planIdParam);
    },
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) return;
      await createSubscriber(token, orgId, {
        ...form,
        email: form.email || undefined,
        address: form.address || undefined,
        planId: form.planId || undefined,
        notes: form.notes || undefined,
      });
      await mutate();
      setShowForm(false);
      setForm({ name: '', phone: '', email: '', address: '', connectionType: 'PPPOE', planId: '', notes: '' });
    } catch (err: any) {
      setFormError(err.message ?? 'Failed to create subscriber');
    } finally {
      setSaving(false);
    }
  };

  const FILTER_TABS: { label: string; value: FilterStatus }[] = [
    { label: 'All', value: 'ALL' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Suspended', value: 'SUSPENDED' },
    { label: 'Churned', value: 'CHURNED' },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[var(--color-accent)]" />
          <h1 className="text-lg font-semibold">Subscribers</h1>
          {subscribers.length > 0 && (
            <span className="ml-1 text-sm text-[var(--color-text-secondary)]">({subscribers.length})</span>
          )}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-white shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Add Subscriber
        </button>
      </div>

      {/* Plan filter banner */}
      {planIdParam && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50 border border-purple-200 mb-4 text-xs text-purple-800">
          <span>
            Filtering by plan: <strong>{servicePlans.find((p) => p.id === planIdParam)?.name ?? 'Selected Plan'}</strong>
          </span>
          <Link href="/subscribers" className="font-bold underline hover:text-purple-950">
            Clear filter ✕
          </Link>
        </div>
      )}

      {/* Filter pills */}
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
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-[var(--color-bg-surface)]" />
          ))}
        </div>
      ) : subscribers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] p-12 text-center">
          <Wifi className="h-10 w-10 text-[var(--color-text-secondary)] mb-3 opacity-40" />
          <p className="font-medium">No subscribers yet</p>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1 mb-4">Add your first ISP subscriber to get started.</p>
          <button
            onClick={() => setShowForm(true)}
            className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Add Subscriber
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {(subscribers as Subscriber[]).map((sub) => (
            <div
              key={sub.id}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4"
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{sub.name}</span>
                    {/* Status badge — large and obvious */}
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLES[sub.status]}`}>
                      {sub.status}
                    </span>
                  </div>
                  {sub.plan && (
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{sub.plan.name}</p>
                  )}
                </div>
                <span className="shrink-0 rounded-lg bg-[var(--color-bg-base)] border border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                  {CONN_LABELS[sub.connectionType]}
                </span>
              </div>

              {/* Phone row — first-class, tappable */}
              <div className="flex items-center gap-3 mt-3">
                <a
                  href={`tel:${sub.phone}`}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--color-bg-base)] border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium hover:border-[var(--color-accent)] transition-colors"
                >
                  <Phone className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                  {sub.phone}
                </a>
                <a
                  href={`https://wa.me/${toWhatsApp(sub.phone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </a>
                <Link
                  href={`/subscribers/${sub.id}`}
                  className="ml-auto rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
                >
                  View →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add subscriber modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">New Subscriber</h2>
              <button onClick={() => setShowForm(false)} className="text-[var(--color-text-secondary)] hover:text-red-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Full Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                  placeholder="e.g. John Kamau"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Phone Number *</label>
                <input
                  required
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                  placeholder="e.g. 0712345678"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                  placeholder="optional"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Install Address</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                  placeholder="e.g. Kilimani, Nairobi"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Service Plan</label>
                <select
                  value={form.planId}
                  onChange={(e) => setForm((f) => ({ ...f, planId: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                >
                  <option value="">No Plan (Assign Later)</option>
                  {servicePlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} — KES {Number(plan.price).toLocaleString()} ({plan.speedMbps ? `${plan.speedMbps} Mbps` : plan.connectionType})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Connection Type</label>
                <select
                  value={form.connectionType}
                  onChange={(e) => setForm((f) => ({ ...f, connectionType: e.target.value as ConnectionType }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                >
                  <option value="PPPOE">PPPoE</option>
                  <option value="HOTSPOT">Hotspot</option>
                  <option value="STATIC_IP">Static IP</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] resize-none"
                  placeholder="Any extra notes..."
                />
              </div>
              {formError && <p className="text-xs text-red-500">{formError}</p>}
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Add Subscriber'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
