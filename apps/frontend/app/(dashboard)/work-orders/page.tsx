'use client';

import React, { useState, useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Wrench,
  Plus,
  X,
  Calendar,
  User,
  Phone,
  CheckCircle2,
  Clock,
  Play,
  Ban,
  MapPin,
  Search,
  MessageSquare,
  Share2,
  Radio,
  ArrowUpRight,
  Sparkles,
  Check,
  Filter,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import {
  getWorkOrders,
  createWorkOrder,
  startWorkOrder,
  completeWorkOrder,
  cancelWorkOrder,
  getSubscribers,
  type WorkOrder,
  type WorkOrderStatus,
  type WorkOrderType,
  type Subscriber,
} from '@/services/isp.service';

const STATUS_CONFIG: Record<
  WorkOrderStatus,
  { label: string; badge: string; icon: React.ElementType }
> = {
  SCHEDULED: {
    label: 'Scheduled',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: Clock,
  },
  IN_PROGRESS: {
    label: 'In Field',
    badge: 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse',
    icon: Play,
  },
  COMPLETED: {
    label: 'Completed',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    icon: CheckCircle2,
  },
  CANCELLED: {
    label: 'Cancelled',
    badge: 'bg-gray-100 text-gray-500 border-gray-200',
    icon: Ban,
  },
};

const TYPE_CONFIG: Record<
  WorkOrderType,
  { label: string; badge: string }
> = {
  INSTALLATION: {
    label: 'New Installation',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  REPAIR: {
    label: 'Fiber Repair / Outage',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  RELOCATION: {
    label: 'Line Relocation',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  MAINTENANCE: {
    label: 'Routine Maintenance',
    badge: 'bg-teal-50 text-teal-700 border-teal-200',
  },
};

const QUICK_HARDWARE_TAGS = [
  'ONU Terminal',
  'Dual-Band Wi-Fi 6 Router',
  '100m Drop Cable',
  'Fast Connectors (SC/UPC)',
  'Patch Cord (1m)',
  'SFP Optical Module',
  'Fiber Splicing Machine',
];

const QUICK_TECHNICIANS = [
  'Dennis K.',
  'Kevin M.',
  'Brian O.',
  'David N.',
  'Field Crew Alpha',
];

type FilterStatus = 'ALL' | WorkOrderStatus;

export default function WorkOrdersPage() {
  const searchParams = useSearchParams();
  const initialAction = searchParams.get('action');

  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const orgId = membership?.organization?.id ?? '';
  const orgName = membership?.organization?.name ?? 'HisaFlow ISP';

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(initialAction === 'add');
  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    subscriberId: '',
    type: 'INSTALLATION' as WorkOrderType,
    scheduledDate: new Date().toISOString().split('T')[0],
    timeSlot: '09:00 AM - Morning',
    technicianName: '',
    notes: '',
  });

  const { data: workOrders = [], isLoading, mutate } = useSWR(
    orgId ? ['work-orders', orgId] : null,
    async () => {
      const token = await getToken();
      if (!token) return [];
      return getWorkOrders(token, orgId);
    },
  );

  const { data: subscribers = [] } = useSWR(
    orgId ? ['subscribers-list-for-workorders', orgId] : null,
    async () => {
      const token = await getToken();
      if (!token) return [];
      return getSubscribers(token, orgId);
    },
  );

  // Metric aggregates
  const metrics = useMemo(() => {
    const scheduled = workOrders.filter((w) => w.status === 'SCHEDULED').length;
    const inProgress = workOrders.filter((w) => w.status === 'IN_PROGRESS').length;
    const completed = workOrders.filter((w) => w.status === 'COMPLETED').length;
    const repairs = workOrders.filter((w) => w.type === 'REPAIR' && w.status !== 'CANCELLED').length;
    const installations = workOrders.filter(
      (w) => w.type === 'INSTALLATION' && w.status !== 'CANCELLED',
    ).length;
    return { scheduled, inProgress, completed, repairs, installations, total: workOrders.length };
  }, [workOrders]);

  // Filtered list
  const filteredOrders = useMemo(() => {
    return workOrders.filter((wo) => {
      if (filterStatus !== 'ALL' && wo.status !== filterStatus) return false;
      if (filterType !== 'ALL' && wo.type !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const subName = wo.subscriber?.name?.toLowerCase() || '';
        const subPhone = wo.subscriber?.phone?.toLowerCase() || '';
        const subAddr = wo.subscriber?.address?.toLowerCase() || '';
        const techName = wo.technicianName?.toLowerCase() || '';
        const notes = wo.notes?.toLowerCase() || '';
        if (
          !subName.includes(q) &&
          !subPhone.includes(q) &&
          !subAddr.includes(q) &&
          !techName.includes(q) &&
          !notes.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [workOrders, filterStatus, filterType, searchQuery]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subscriberId) {
      setError('Please select a subscriber');
      return;
    }
    setError(null);
    setSaving(true);

    try {
      const token = await getToken();
      if (!token) return;

      const scheduledDateTime = form.scheduledDate
        ? new Date(`${form.scheduledDate}T10:00:00`).toISOString()
        : undefined;

      const notesCombined = [
        form.timeSlot ? `Slot: ${form.timeSlot}` : null,
        form.notes.trim() ? form.notes.trim() : null,
      ]
        .filter(Boolean)
        .join(' | ');

      await createWorkOrder(token, orgId, {
        subscriberId: form.subscriberId,
        type: form.type,
        scheduledAt: scheduledDateTime,
        technicianName: form.technicianName.trim() || undefined,
        notes: notesCombined || undefined,
      });

      await mutate();
      setShowModal(false);
      setForm({
        subscriberId: '',
        type: 'INSTALLATION',
        scheduledDate: new Date().toISOString().split('T')[0],
        timeSlot: '09:00 AM - Morning',
        technicianName: '',
        notes: '',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create work order');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, action: 'start' | 'complete' | 'cancel') => {
    setActionLoadingId(id);
    try {
      const token = await getToken();
      if (!token) return;
      if (action === 'start') await startWorkOrder(token, orgId, id);
      if (action === 'complete') await completeWorkOrder(token, orgId, id);
      if (action === 'cancel') {
        if (!confirm('Are you sure you want to cancel this work order dispatch?')) return;
        await cancelWorkOrder(token, orgId, id);
      }
      await mutate();
    } catch (err: any) {
      alert(err.message || `Failed to ${action} work order`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Build formatted WhatsApp dispatch text for field technician
  const buildTechnicianWhatsAppLink = (wo: WorkOrder) => {
    const dateFormatted = wo.scheduledAt
      ? new Date(wo.scheduledAt).toLocaleDateString('en-KE', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : 'Immediate / As Scheduled';

    const text = `🔧 *FIELD WORK DISPATCH — ${orgName}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `*Job Type:* ${TYPE_CONFIG[wo.type]?.label || wo.type}\n` +
      `*Scheduled:* ${dateFormatted}\n` +
      `*Assigned Tech:* ${wo.technicianName || 'Field Team'}\n\n` +
      `👤 *SUBSCRIBER DETAILS:*\n` +
      `*Name:* ${wo.subscriber?.name}\n` +
      `*Phone:* ${wo.subscriber?.phone}\n` +
      `*Address/Site:* ${wo.subscriber?.address || 'Site coordinates on file'}\n` +
      (wo.subscriber?.plan ? `*Service Plan:* ${wo.subscriber.plan.name}\n` : '') +
      `\n📝 *INSTRUCTIONS & HARDWARE:*\n` +
      `${wo.notes || 'Standard installation/repair equipment required.'}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `Please confirm dispatch and notify customer before arrival.`;

    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  // Build WhatsApp text for the subscriber directly
  const buildSubscriberWhatsAppLink = (wo: WorkOrder) => {
    const rawPhone = wo.subscriber?.phone?.replace(/\D/g, '') || '';
    const phone = rawPhone.startsWith('0')
      ? '254' + rawPhone.slice(1)
      : rawPhone.startsWith('254')
      ? rawPhone
      : '254' + rawPhone;

    const dateFormatted = wo.scheduledAt
      ? new Date(wo.scheduledAt).toLocaleDateString('en-KE', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      : 'today';

    const text = `Hello ${wo.subscriber?.name}, your ${TYPE_CONFIG[wo.type]?.label || 'service'} dispatch with ${orgName} is scheduled for ${dateFormatted}. Our field technician ${wo.technicianName ? `(${wo.technicianName})` : ''} will arrive shortly. Reach us if you need to reschedule. Thank you!`;

    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  const addHardwareTag = (tag: string) => {
    setForm((prev) => {
      const current = prev.notes ? prev.notes.trim() : '';
      if (current.includes(tag)) return prev;
      return {
        ...prev,
        notes: current ? `${current}, ${tag}` : tag,
      };
    });
  };

  return (
    <div className="flex flex-col gap-6 pb-24 max-w-5xl mx-auto p-4 sm:p-6">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800 shrink-0">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[var(--color-text-primary)] tracking-tight">
                Field Work & Dispatch
              </h1>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Manage field deployments, technician routes, customer installations, and fiber repairs.
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setError(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            New Field Dispatch
          </button>
        </div>
      </div>

      {/* ── Dispatch Overview Metrics Ribbon ────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Scheduled */}
        <div className="flex flex-col justify-between rounded-2xl border border-blue-200/80 bg-blue-50/40 p-3.5 sm:p-4 shadow-2xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-bold text-blue-800 uppercase tracking-wider truncate">
              Pending
            </span>
            <Clock className="h-4 w-4 text-blue-600 shrink-0" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-blue-900 mt-2 truncate">
            {metrics.scheduled}
          </p>
          <span className="text-[11px] text-blue-700 font-medium mt-1 truncate">
            Awaiting dispatch
          </span>
        </div>

        {/* Metric 2: In Progress */}
        <div className="flex flex-col justify-between rounded-2xl border border-amber-200/80 bg-amber-50/40 p-3.5 sm:p-4 shadow-2xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider truncate">
              In Field
            </span>
            <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-ping shrink-0" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-900 mt-2 truncate">
            {metrics.inProgress}
          </p>
          <span className="text-[11px] text-amber-700 font-medium mt-1 truncate">
            Active on-site
          </span>
        </div>

        {/* Metric 3: Completed */}
        <div className="flex flex-col justify-between rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 sm:p-4 shadow-2xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider truncate">
              Completed
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-900 mt-2 truncate">
            {metrics.completed}
          </p>
          <span className="text-[11px] text-emerald-700 font-medium mt-1 truncate">
            Resolved jobs
          </span>
        </div>

        {/* Metric 4: Repairs vs Installs */}
        <div className="flex flex-col justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3.5 sm:p-4 shadow-2xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider truncate">
              Total Jobs
            </span>
            <Layers className="h-4 w-4 text-[var(--color-text-muted)] shrink-0" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-[var(--color-text-primary)] mt-2 truncate">
            {metrics.total}
          </p>
          <span className="text-[11px] text-[var(--color-text-muted)] font-medium mt-1 truncate">
            {metrics.installations} Installs · {metrics.repairs} Repairs
          </span>
        </div>
      </div>

      {/* ── Filter & Search Toolbar ─────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {(
              [
                { label: 'All Jobs', value: 'ALL', count: metrics.total },
                { label: 'Scheduled', value: 'SCHEDULED', count: metrics.scheduled },
                { label: 'In Field', value: 'IN_PROGRESS', count: metrics.inProgress },
                { label: 'Completed', value: 'COMPLETED', count: metrics.completed },
                { label: 'Cancelled', value: 'CANCELLED', count: workOrders.filter((w) => w.status === 'CANCELLED').length },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilterStatus(tab.value)}
                className={`flex items-center gap-1.5 shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  filterStatus === tab.value
                    ? 'bg-[var(--color-accent)] text-white shadow-xs'
                    : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/50'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    filterStatus === tab.value ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Job Type Filter */}
          <div className="flex items-center gap-2 shrink-0">
            <Filter className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-xs font-medium outline-none focus:border-[var(--color-accent)]"
            >
              <option value="ALL">All Job Types</option>
              <option value="INSTALLATION">New Installation</option>
              <option value="REPAIR">Fiber Repair / Outage</option>
              <option value="RELOCATION">Line Relocation</option>
              <option value="MAINTENANCE">Routine Maintenance</option>
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search by subscriber name, phone, address, assigned technician, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] pl-10 pr-4 py-2.5 text-xs font-medium outline-none focus:border-[var(--color-accent)] shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-muted)] hover:text-black"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Work Order Dispatch List ────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]"
            />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-surface)] p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 mb-3">
            <Wrench className="h-6 w-6 opacity-80" />
          </div>
          <p className="font-bold text-base text-[var(--color-text-primary)]">
            No work orders match this filter
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-sm">
            {searchQuery
              ? `No dispatches found matching "${searchQuery}". Try clearing your search query.`
              : 'Schedule field installations, line repairs, or customer relocations for your field teams.'}
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setFilterStatus('ALL');
              setFilterType('ALL');
              setShowModal(true);
            }}
            className="mt-4 flex items-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-xs font-bold text-white shadow-xs hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            Create First Field Dispatch
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((wo: WorkOrder) => {
            const StatusIcon = STATUS_CONFIG[wo.status]?.icon || Clock;
            const statusStyle = STATUS_CONFIG[wo.status]?.badge || 'bg-gray-100 text-gray-700';
            const typeLabel = TYPE_CONFIG[wo.type]?.label || wo.type;
            const typeStyle = TYPE_CONFIG[wo.type]?.badge || 'bg-gray-100 text-gray-700';

            return (
              <div
                key={wo.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 sm:p-5 shadow-xs hover:border-[var(--color-accent)]/50 hover:shadow-md transition-all overflow-hidden"
              >
                {/* Card Top: Type, Status, and Scheduled Date */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--color-border)]/60">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className={`text-[11px] px-2 py-0.5 rounded-lg font-bold border shrink-0 ${typeStyle}`}>
                      {typeLabel}
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-lg font-bold border flex items-center gap-1 shrink-0 ${statusStyle}`}>
                      <StatusIcon className="h-3 w-3" />
                      {STATUS_CONFIG[wo.status]?.label || wo.status}
                    </span>
                  </div>

                  {/* Scheduled Date */}
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-text-secondary)] shrink-0">
                    <Calendar className="h-3 w-3 text-[var(--color-accent)] shrink-0" />
                    <span>
                      {wo.scheduledAt
                        ? new Date(wo.scheduledAt).toLocaleDateString('en-KE', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'Immediate / Unscheduled'}
                    </span>
                  </div>
                </div>

                {/* Card Body: Subscriber Details & Technician Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-3.5">
                  {/* Subscriber & Location */}
                  <div className="min-w-0 space-y-1.5">
                    <Link
                      href={`/subscribers/${wo.subscriberId}`}
                      className="font-bold text-sm text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors flex items-center gap-1 min-w-0"
                    >
                      <span className="truncate">{wo.subscriber?.name || 'Unnamed Subscriber'}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 opacity-60 shrink-0" />
                    </Link>

                    <div className="flex items-center gap-2 flex-wrap text-xs text-[var(--color-text-secondary)]">
                      <a
                        href={`tel:${wo.subscriber?.phone}`}
                        className="flex items-center gap-1 text-[var(--color-accent)] font-medium hover:underline shrink-0"
                      >
                        <Phone className="h-3 w-3" />
                        {wo.subscriber?.phone}
                      </a>
                      {wo.subscriber?.plan && (
                        <span className="bg-gray-100 px-2 py-0.5 rounded-md text-[11px] font-medium text-gray-700 shrink-0">
                          {wo.subscriber.plan.name}
                        </span>
                      )}
                    </div>

                    {wo.subscriber?.address && (
                      <p className="flex items-start gap-1 text-xs text-[var(--color-text-secondary)] mt-1 min-w-0">
                        <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-2 break-words">{wo.subscriber.address}</span>
                      </p>
                    )}
                  </div>

                  {/* Assigned Field Tech & Quick Dispatch */}
                  <div className="flex flex-col justify-between rounded-xl bg-[var(--color-bg-base)] border border-[var(--color-border)] p-3 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
                        <User className="h-3.5 w-3.5 text-[var(--color-text-secondary)] shrink-0" />
                        <span className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                          {wo.technicianName || 'Unassigned'}
                        </span>
                      </div>

                      {wo.notes && (
                        <p className="text-[11px] text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed break-words">
                          {wo.notes}
                        </p>
                      )}
                    </div>

                    {/* Quick WhatsApp Dispatch to Technician & Customer */}
                    <div className="mt-2.5 pt-2 border-t border-[var(--color-border)] flex items-center gap-2 flex-wrap">
                      <a
                        href={buildTechnicianWhatsAppLink(wo)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/70 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200/70 transition-colors shrink-0"
                        title="Share complete job briefing to field technician on WhatsApp"
                      >
                        <Share2 className="h-3 w-3 text-emerald-700 shrink-0" />
                        Dispatch
                      </a>

                      <a
                        href={buildSubscriberWhatsAppLink(wo)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg border border-blue-200/70 transition-colors shrink-0"
                        title="Notify customer on WhatsApp"
                      >
                        <MessageSquare className="h-3 w-3 text-blue-600 shrink-0" />
                        Notify
                      </a>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Status Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)]/60 flex-wrap gap-2">
                  <div className="text-[11px] text-[var(--color-text-muted)] font-medium min-w-0">
                    {wo.completedAt ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 shrink-0" /> Completed{' '}
                        {new Date(wo.completedAt).toLocaleDateString('en-KE', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    ) : (
                      <span>#{wo.id.slice(-6).toUpperCase()}</span>
                    )}
                  </div>

                  {/* Actions according to status */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {wo.status === 'SCHEDULED' && (
                      <>
                        <button
                          disabled={actionLoadingId === wo.id}
                          onClick={() => handleStatusChange(wo.id, 'start')}
                          className="flex items-center gap-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-[11px] font-bold shadow-xs transition-colors disabled:opacity-60 shrink-0"
                        >
                          <Play className="h-3 w-3" />
                          En Route
                        </button>
                        <button
                          disabled={actionLoadingId === wo.id}
                          onClick={() => handleStatusChange(wo.id, 'cancel')}
                          className="rounded-xl border border-gray-200 hover:bg-gray-100 px-2.5 py-1.5 text-[11px] font-semibold text-gray-500 transition-colors shrink-0"
                        >
                          Cancel
                        </button>
                      </>
                    )}

                    {wo.status === 'IN_PROGRESS' && (
                      <>
                        <button
                          disabled={actionLoadingId === wo.id}
                          onClick={() => handleStatusChange(wo.id, 'complete')}
                          className="flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-[11px] font-bold shadow-xs transition-colors disabled:opacity-60 shrink-0"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Done
                        </button>
                        <button
                          disabled={actionLoadingId === wo.id}
                          onClick={() => handleStatusChange(wo.id, 'cancel')}
                          className="rounded-xl border border-gray-200 hover:bg-gray-100 px-2.5 py-1.5 text-[11px] font-semibold text-gray-500 transition-colors shrink-0"
                        >
                          Cancel
                        </button>
                      </>
                    )}

                    {wo.status === 'COMPLETED' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0">
                        <Check className="h-3 w-3" /> Finalized
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal: New Field Dispatch / Work Order ─────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
              <div>
                <h2 className="font-bold text-lg text-[var(--color-text-primary)]">
                  Schedule Field Work Dispatch
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  Assign a field technician, equipment, and subscriber installation route.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-[var(--color-text-secondary)] hover:text-red-500 p-1.5 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              {/* Subscriber selection */}
              <div>
                <label className="text-xs font-bold text-[var(--color-text-primary)] block mb-1">
                  Select Subscriber *
                </label>
                <select
                  required
                  value={form.subscriberId}
                  onChange={(e) => setForm((f) => ({ ...f, subscriberId: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3.5 py-2.5 text-xs font-medium outline-none focus:border-[var(--color-accent)]"
                >
                  <option value="">Choose subscriber from fleet...</option>
                  {subscribers.map((s: Subscriber) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.phone}) — {s.address || 'No address'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Job Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[var(--color-text-primary)] block mb-1">
                    Job Classification *
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as WorkOrderType }))}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-xs font-medium outline-none focus:border-[var(--color-accent)]"
                  >
                    <option value="INSTALLATION">New Installation</option>
                    <option value="REPAIR">Fiber Repair / Outage</option>
                    <option value="RELOCATION">Line Relocation</option>
                    <option value="MAINTENANCE">Routine Maintenance</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--color-text-primary)] block mb-1">
                    Scheduled Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.scheduledDate}
                    onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-xs font-medium outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
              </div>

              {/* Time Slot & Assigned Tech */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[var(--color-text-primary)] block mb-1">
                    Target Time Slot
                  </label>
                  <select
                    value={form.timeSlot}
                    onChange={(e) => setForm((f) => ({ ...f, timeSlot: e.target.value }))}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-xs font-medium outline-none focus:border-[var(--color-accent)]"
                  >
                    <option value="08:30 AM - Early Morning">08:30 AM - Early Morning</option>
                    <option value="11:00 AM - Mid-Day">11:00 AM - Mid-Day</option>
                    <option value="02:30 PM - Afternoon">02:30 PM - Afternoon</option>
                    <option value="05:00 PM - Evening">05:00 PM - Evening</option>
                    <option value="Flexible All Day">Flexible All Day</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--color-text-primary)] block mb-1">
                    Assigned Field Technician
                  </label>
                  <input
                    value={form.technicianName}
                    onChange={(e) => setForm((f) => ({ ...f, technicianName: e.target.value }))}
                    placeholder="e.g. Dennis K. or Team 1"
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-xs font-medium outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
              </div>

              {/* Quick Tech Picker Chips */}
              <div>
                <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] block mb-1">
                  Quick Assign Technician:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {QUICK_TECHNICIANS.map((tech) => (
                    <button
                      type="button"
                      key={tech}
                      onClick={() => setForm((f) => ({ ...f, technicianName: tech }))}
                      className={`text-[11px] px-2.5 py-0.5 rounded-lg border font-medium transition-colors ${
                        form.technicianName === tech
                          ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                          : 'bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-700'
                      }`}
                    >
                      {tech}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Hardware Checklist Chips */}
              <div>
                <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] block mb-1">
                  Required Equipment & Hardware (click to append to notes):
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {QUICK_HARDWARE_TAGS.map((tag) => (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => addHardwareTag(tag)}
                      className="text-[11px] px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 hover:bg-blue-100 transition-colors font-medium"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Instructions & Site Notes */}
              <div>
                <label className="text-xs font-bold text-[var(--color-text-primary)] block mb-1">
                  Technician Instructions & Hardware Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-xs font-medium outline-none focus:border-[var(--color-accent)] resize-none"
                  placeholder="e.g. Take 1x Dual-Band Router, 1x ONU. Customer requested router placement on 2nd floor. Call before arrival."
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-xl border border-[var(--color-border)] py-2.5 text-xs font-bold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-base)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-[var(--color-accent)] py-2.5 text-xs font-bold text-white shadow-xs hover:opacity-90 disabled:opacity-60 transition-opacity"
                >
                  {saving ? 'Scheduling Dispatch…' : 'Schedule Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
