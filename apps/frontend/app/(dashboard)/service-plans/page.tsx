'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';
import {
  Wifi,
  Plus,
  X,
  Tag,
  Zap,
  CheckCircle2,
  DollarSign,
  Users,
  MessageCircle,
  ExternalLink,
  ChevronRight,
  Phone,
} from 'lucide-react';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import {
  getServicePlans,
  createServicePlan,
  deleteServicePlan,
  getSubscribers,
  type ServicePlan,
  type Subscriber,
  type ConnectionType,
  type BillingCycle,
} from '@/services/isp.service';

const CYCLE_LABELS: Record<BillingCycle, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  ANNUAL: 'Annual',
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

export default function ServicePlansPage() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const orgId = membership?.organization?.id ?? '';

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlanForSubscribers, setSelectedPlanForSubscribers] = useState<ServicePlan | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    billingCycle: 'MONTHLY' as BillingCycle,
    connectionType: 'PPPOE' as ConnectionType,
    speedMbps: '',
  });

  const { data: plans = [], isLoading, mutate } = useSWR(
    orgId ? ['service-plans', orgId] : null,
    async () => {
      const token = await getToken();
      if (!token) return [];
      return getServicePlans(token, orgId);
    },
  );

  const { data: planSubscribers = [], isLoading: loadingSubscribers } = useSWR<Subscriber[]>(
    orgId && selectedPlanForSubscribers ? ['plan-subscribers', orgId, selectedPlanForSubscribers.id] : null,
    async () => {
      const token = await getToken();
      if (!token || !selectedPlanForSubscribers) return [];
      return getSubscribers(token, orgId, undefined, selectedPlanForSubscribers.id);
    },
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) return;
      await createServicePlan(token, orgId, {
        name: form.name,
        description: form.description || undefined,
        price: Number(form.price),
        billingCycle: form.billingCycle,
        connectionType: form.connectionType,
        speedMbps: form.speedMbps ? Number(form.speedMbps) : undefined,
      });
      await mutate();
      setShowModal(false);
      setForm({
        name: '',
        description: '',
        price: '',
        billingCycle: 'MONTHLY',
        connectionType: 'PPPOE',
        speedMbps: '',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this plan?')) return;
    try {
      const token = await getToken();
      if (!token) return;
      await deleteServicePlan(token, orgId, id);
      await mutate();
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate plan');
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-[var(--color-accent)]" />
          <h1 className="text-lg font-semibold">Service Plans</h1>
          {plans.length > 0 && (
            <span className="ml-1 text-sm text-[var(--color-text-secondary)]">({plans.length})</span>
          )}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          New Plan
        </button>
      </div>

      {/* Plans List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)]" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] p-12 text-center">
          <Wifi className="h-10 w-10 text-[var(--color-text-secondary)] mb-3 opacity-40" />
          <p className="font-medium">No service plans configured</p>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1 mb-4">
            Create your bandwidth and internet tiers to assign to subscribers.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Create First Plan
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map((plan: ServicePlan) => {
            const subCount = plan._count?.subscribers ?? 0;
            return (
              <div
                key={plan.id}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 shadow-sm transition-all hover:border-[var(--color-accent)]/30"
              >
                {/* Header row: Plan Title & Status */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[var(--color-accent)] shrink-0 border border-emerald-100">
                      <Wifi className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-bold text-base text-[var(--color-text-primary)]">{plan.name}</h2>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[var(--color-bg-base)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                          {CYCLE_LABELS[plan.billingCycle]}
                        </span>
                      </div>
                      {plan.description && (
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-2">
                          {plan.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-semibold shrink-0 ${
                      plan.isActive
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-gray-100 text-gray-500 border border-gray-200'
                    }`}
                  >
                    {plan.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Structured Metrics Bar: 3 balanced columns */}
                <div className="grid grid-cols-3 gap-2 my-3.5 py-2.5 px-3 rounded-xl bg-[var(--color-bg-base)] border border-[var(--color-border)] text-center sm:text-left">
                  {/* Speed */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mx-auto sm:mx-0 shrink-0">
                      <Zap className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-[var(--color-text-secondary)] block uppercase tracking-wider font-semibold">Speed</span>
                      <span className="text-xs font-bold text-[var(--color-text-primary)] truncate block">
                        {plan.speedMbps ? `${plan.speedMbps} Mbps` : 'Uncapped'}
                      </span>
                    </div>
                  </div>

                  {/* Connection */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 border-x border-[var(--color-border)] px-2">
                    <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mx-auto sm:mx-0 shrink-0">
                      <Tag className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-[var(--color-text-secondary)] block uppercase tracking-wider font-semibold">Type</span>
                      <span className="text-xs font-bold text-[var(--color-text-primary)] truncate block">
                        {CONN_LABELS[plan.connectionType]}
                      </span>
                    </div>
                  </div>

                  {/* Subscriber Count — Clickable */}
                  <button
                    type="button"
                    onClick={() => setSelectedPlanForSubscribers(plan)}
                    className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 p-1 -m-1 rounded-lg hover:bg-purple-100/60 active:scale-95 transition-all text-left group w-full"
                    title="Click to view subscribers on this plan"
                  >
                    <div className="h-7 w-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mx-auto sm:mx-0 shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                      <Users className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-[var(--color-text-secondary)] block uppercase tracking-wider font-semibold group-hover:text-purple-700 flex items-center gap-0.5">
                        Subscribers <span className="opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
                      </span>
                      <span className="text-xs font-bold text-purple-700 underline decoration-dotted underline-offset-2 truncate block">
                        {subCount} {subCount === 1 ? 'user' : 'users'}
                      </span>
                    </div>
                  </button>
                </div>

                {/* Footer: Price + Actions */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-extrabold text-[var(--color-accent)]">
                      KES {Number(plan.price).toLocaleString()}
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)] font-medium">
                      / {CYCLE_LABELS[plan.billingCycle].toLowerCase()}
                    </span>
                  </div>

                  {plan.isActive && (
                    <button
                      onClick={() => handleDeactivate(plan.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium px-2.5 py-1 rounded-lg border border-transparent hover:border-red-200 transition-colors"
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base">New Service Plan</h2>
              <button onClick={() => setShowModal(false)} className="text-[var(--color-text-secondary)] hover:text-red-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Plan Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                  placeholder="e.g. 10Mbps Home Unlimited"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[var(--color-text-secondary)]">Price (KES) *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                    placeholder="2500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--color-text-secondary)]">Speed (Mbps)</label>
                  <input
                    type="number"
                    min="1"
                    value={form.speedMbps}
                    onChange={(e) => setForm((f) => ({ ...f, speedMbps: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                    placeholder="10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[var(--color-text-secondary)]">Billing Cycle</label>
                  <select
                    value={form.billingCycle}
                    onChange={(e) => setForm((f) => ({ ...f, billingCycle: e.target.value as BillingCycle }))}
                    className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="ANNUAL">Annual</option>
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
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] resize-none"
                  placeholder="e.g. Recommended for households with 4+ devices"
                />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90 transition-opacity"
              >
                {saving ? 'Creating…' : 'Create Plan'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Plan Subscribers Modal */}
      {selectedPlanForSubscribers && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] p-5 shadow-2xl max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-[var(--color-border)]">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-base text-[var(--color-text-primary)]">
                    {selectedPlanForSubscribers.name}
                  </h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 font-bold border border-purple-200">
                    {planSubscribers.length} {planSubscribers.length === 1 ? 'subscriber' : 'subscribers'}
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  KES {Number(selectedPlanForSubscribers.price).toLocaleString()} / {CYCLE_LABELS[selectedPlanForSubscribers.billingCycle].toLowerCase()} • {selectedPlanForSubscribers.speedMbps ? `${selectedPlanForSubscribers.speedMbps} Mbps` : selectedPlanForSubscribers.connectionType}
                </p>
              </div>
              <button
                onClick={() => setSelectedPlanForSubscribers(null)}
                className="text-[var(--color-text-secondary)] hover:text-red-500 p-1.5 rounded-xl hover:bg-[var(--color-bg-base)] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Subscribers List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
              {loadingSubscribers ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--color-bg-base)]" />
                  ))}
                </div>
              ) : planSubscribers.length === 0 ? (
                <div className="py-10 text-center text-sm text-[var(--color-text-secondary)]">
                  <Users className="h-9 w-9 mx-auto mb-2 opacity-30 text-purple-600" />
                  <p className="font-semibold text-[var(--color-text-primary)]">No subscribers on this plan yet</p>
                  <p className="text-xs mt-1 text-[var(--color-text-muted)] max-w-xs mx-auto">
                    Subscribers assigned to this tier will appear here automatically.
                  </p>
                  <Link
                    href="/subscribers?action=add"
                    className="inline-flex items-center gap-1.5 mt-4 rounded-xl bg-[var(--color-accent)] px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Subscriber
                  </Link>
                </div>
              ) : (
                planSubscribers.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] hover:border-[var(--color-accent)]/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[var(--color-text-primary)] truncate">
                          {sub.name}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            sub.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : sub.status === 'SUSPENDED'
                              ? 'bg-amber-100 text-amber-700 border border-amber-200'
                              : 'bg-rose-100 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {sub.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-[var(--color-text-secondary)]">
                        <span>{sub.phone}</span>
                        {sub.address && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[150px]">{sub.address}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={`https://wa.me/${toWhatsApp(sub.phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title="WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                      <Link
                        href={`/subscribers/${sub.id}`}
                        className="flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:border-[var(--color-accent)] transition-colors"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between">
              <Link
                href={`/subscribers?planId=${selectedPlanForSubscribers.id}`}
                className="text-xs font-semibold text-[var(--color-accent)] hover:underline flex items-center gap-1"
              >
                Open in Subscribers directory →
              </Link>
              <button
                onClick={() => setSelectedPlanForSubscribers(null)}
                className="px-4 py-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
