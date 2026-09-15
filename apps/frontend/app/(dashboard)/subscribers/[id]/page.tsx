'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Phone,
  MessageCircle,
  ChevronLeft,
  Wifi,
  Calendar,
  MapPin,
  FileText,
  Briefcase,
  TicketCheck,
  Plus,
  X,
  CreditCard,
  DollarSign,
  Package,
  CheckCircle2,
  Play,
  RotateCcw,
  Edit2,
  Server,
  Power,
  AlertTriangle,
} from 'lucide-react';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import {
  getSubscriber,
  updateSubscriber,
  suspendSubscriber,
  reactivateSubscriber,
  churnSubscriber,
  getServicePlans,
  generateIspInvoice,
  getIspInvoicesBySubscriber,
  addIspLineItem,
  recordIspPayment,
  issueIspInvoice,
  voidIspInvoice,
  issueEquipment,
  getEquipmentBySubscriber,
  createWorkOrder,
  getWorkOrders,
  startWorkOrder,
  completeWorkOrder,
  cancelWorkOrder,
  createTicket,
  getTickets,
  startTicket,
  resolveTicket,
  closeTicket,
  reopenTicket,
  linkSubscriberRouter,
  routerSuspendSubscriber,
  routerReconnectSubscriber,
  getSubscriberRouterActions,
  type Subscriber,
  type SubscriberStatus,
  type ConnectionType,
  type ServicePlan,
  type IspInvoice,
  type EquipmentTransaction,
  type WorkOrder,
  type Ticket,
  type WorkOrderType,
} from '@/services/isp.service';
import { getRouters, type Router } from '@/services/routers.service';
import { getInventoryItems, type Product, type InventoryItem } from '@/services/inventory.service';

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

type Tab = 'overview' | 'invoices' | 'equipment' | 'work-orders' | 'tickets' | 'router';

export default function SubscriberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const orgId = membership?.organization?.id ?? '';

  const [tab, setTab] = useState<Tab>('overview');
  const [actionLoading, setActionLoading] = useState(false);

  // Modals state
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState<string | null>(null);
  const [showLineItemModal, setShowLineItemModal] = useState<string | null>(null);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showRouterLinkModal, setShowRouterLinkModal] = useState(false);

  // Form states
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '', address: '', planId: '', notes: '' });
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'MPESA', note: '' });
  const [lineItemForm, setLineItemForm] = useState({ description: '', quantity: '1', unitPrice: '' });
  const [equipmentForm, setEquipmentForm] = useState({ itemId: '', quantity: '1', notes: '', chargeToInvoice: true });
  const [workOrderForm, setWorkOrderForm] = useState({ type: 'INSTALLATION' as WorkOrderType, scheduledAt: '', technicianName: '', notes: '' });
  const [ticketForm, setTicketForm] = useState({ subject: '', description: '' });
  const [routerLinkForm, setRouterLinkForm] = useState({ routerId: '', routerAccountRef: '' });

  // 1. Subscriber Data
  const { data: subscriber, isLoading, mutate: mutateSubscriber } = useSWR<Subscriber>(
    orgId && id ? ['subscriber', orgId, id] : null,
    async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const data = await getSubscriber(token, orgId, id);
      setEditForm({
        name: data.name,
        phone: data.phone,
        email: data.email || '',
        address: data.address || '',
        planId: data.planId || '',
        notes: data.notes || '',
      });
      setRouterLinkForm({
        routerId: data.routerId || '',
        routerAccountRef: data.routerAccountRef || '',
      });
      return data;
    },
  );

  // 2. Service Plans
  const { data: servicePlans = [] } = useSWR<ServicePlan[]>(
    orgId ? ['service-plans', orgId] : null,
    async () => {
      const token = await getToken();
      if (!token) return [];
      return getServicePlans(token, orgId, true);
    },
  );

  // 3. Invoices
  const { data: invoices = [], mutate: mutateInvoices } = useSWR<IspInvoice[]>(
    orgId && id && tab === 'invoices' ? ['isp-invoices', orgId, id] : null,
    async () => {
      const token = await getToken();
      if (!token) return [];
      return getIspInvoicesBySubscriber(token, orgId, id);
    },
  );

  // 4. Equipment
  const { data: equipmentList = [], mutate: mutateEquipment } = useSWR<EquipmentTransaction[]>(
    orgId && id && tab === 'equipment' ? ['isp-equipment', orgId, id] : null,
    async () => {
      const token = await getToken();
      if (!token) return [];
      return getEquipmentBySubscriber(token, orgId, id);
    },
  );

  // 5. Work Orders
  const { data: workOrders = [], mutate: mutateWorkOrders } = useSWR<WorkOrder[]>(
    orgId && id && tab === 'work-orders' ? ['isp-work-orders', orgId, id] : null,
    async () => {
      const token = await getToken();
      if (!token) return [];
      return getWorkOrders(token, orgId, undefined, id);
    },
  );

  // 6. Tickets
  const { data: tickets = [], mutate: mutateTickets } = useSWR<Ticket[]>(
    orgId && id && tab === 'tickets' ? ['isp-tickets', orgId, id] : null,
    async () => {
      const token = await getToken();
      if (!token) return [];
      return getTickets(token, orgId, undefined, id);
    },
  );

  // 7. Inventory Items (for equipment picker)
  const { data: inventoryProducts = [] } = useSWR<Product[]>(
    orgId && showEquipmentModal ? ['inventory-items', orgId] : null,
    async () => {
      const token = await getToken();
      if (!token) return [];
      return getInventoryItems(token, orgId);
    },
  );

  const flatInventoryItems: InventoryItem[] = inventoryProducts.flatMap((p) => p.variants || []);

  // 8. Routers list (for linking)
  const { data: routers = [] } = useSWR<Router[]>(
    orgId && (showRouterLinkModal || tab === 'router') ? ['routers', orgId] : null,
    async () => {
      const token = await getToken();
      if (!token) return [];
      return getRouters(token, orgId);
    },
  );

  // 9. Router Action Logs
  const { data: routerActions = [], mutate: mutateRouterActions } = useSWR<any[]>(
    orgId && id && tab === 'router' ? ['subscriber-router-actions', orgId, id] : null,
    async () => {
      const token = await getToken();
      if (!token) return [];
      return getSubscriberRouterActions(token, orgId, id);
    },
  );

  // Router Handlers
  const handleLinkRouter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routerLinkForm.routerId || !routerLinkForm.routerAccountRef) return;
    setActionLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      await linkSubscriberRouter(token, orgId, id, routerLinkForm.routerId, routerLinkForm.routerAccountRef);
      await mutateSubscriber();
      setShowRouterLinkModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to link router');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRouterSuspend = async () => {
    if (!confirm('Suspend this subscriber on the router immediately? Their internet session will be cut.')) return;
    setActionLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await routerSuspendSubscriber(token, orgId, id);
      if (!res.success) {
        alert('Router suspend failed: ' + (res.error || 'Unknown error'));
      }
      await mutateSubscriber();
      await mutateRouterActions();
    } catch (err: any) {
      alert(err.message || 'Failed to suspend on router');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRouterReconnect = async () => {
    if (!confirm('Reconnect this subscriber on the router immediately? Their internet session will be restored.')) return;
    setActionLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await routerReconnectSubscriber(token, orgId, id);
      if (!res.success) {
        alert('Router reconnect failed: ' + (res.error || 'Unknown error'));
      }
      await mutateSubscriber();
      await mutateRouterActions();
    } catch (err: any) {
      alert(err.message || 'Failed to reconnect on router');
    } finally {
      setActionLoading(false);
    }
  };

  // Handlers
  const handleEditSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      await updateSubscriber(token, orgId, id, {
        name: editForm.name,
        phone: editForm.phone,
        email: editForm.email || undefined,
        address: editForm.address || undefined,
        planId: editForm.planId ? editForm.planId : null as any,
        notes: editForm.notes || undefined,
      });
      await mutateSubscriber();
      setShowEditModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to update subscriber');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (action: 'suspend' | 'reactivate' | 'churn') => {
    if (!confirm(`Are you sure you want to mark this subscriber as ${action.toUpperCase()}?`)) return;
    setActionLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      if (action === 'suspend') await suspendSubscriber(token, orgId, id);
      if (action === 'reactivate') await reactivateSubscriber(token, orgId, id);
      if (action === 'churn') await churnSubscriber(token, orgId, id);
      await mutateSubscriber();
    } catch (err: any) {
      alert(err.message || `Failed to ${action} subscriber`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateInvoice = async () => {
    setActionLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      await generateIspInvoice(token, orgId, { subscriberId: id, planId: subscriber?.planId });
      await mutateInvoices();
      await mutateSubscriber();
      setShowInvoiceModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to generate invoice');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPaymentModal) return;
    setActionLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      await recordIspPayment(token, orgId, showPaymentModal, {
        amount: Number(paymentForm.amount),
        method: paymentForm.method,
        note: paymentForm.note || undefined,
      });
      await mutateInvoices();
      setShowPaymentModal(null);
      setPaymentForm({ amount: '', method: 'MPESA', note: '' });
    } catch (err: any) {
      alert(err.message || 'Failed to record payment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddLineItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showLineItemModal) return;
    setActionLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      await addIspLineItem(token, orgId, showLineItemModal, {
        description: lineItemForm.description,
        quantity: Number(lineItemForm.quantity),
        unitPrice: Number(lineItemForm.unitPrice),
      });
      await mutateInvoices();
      setShowLineItemModal(null);
      setLineItemForm({ description: '', quantity: '1', unitPrice: '' });
    } catch (err: any) {
      alert(err.message || 'Failed to add line item');
    } finally {
      setActionLoading(false);
    }
  };

  const handleIssueEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      await issueEquipment(token, orgId, {
        subscriberId: id,
        itemId: equipmentForm.itemId,
        quantity: Number(equipmentForm.quantity),
        notes: equipmentForm.notes || undefined,
        chargeToInvoice: equipmentForm.chargeToInvoice,
      });
      await mutateEquipment();
      setShowEquipmentModal(false);
      setEquipmentForm({ itemId: '', quantity: '1', notes: '', chargeToInvoice: true });
    } catch (err: any) {
      alert(err.message || 'Failed to issue equipment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      await createWorkOrder(token, orgId, {
        subscriberId: id,
        type: workOrderForm.type,
        scheduledAt: workOrderForm.scheduledAt ? new Date(workOrderForm.scheduledAt).toISOString() : undefined,
        technicianName: workOrderForm.technicianName || undefined,
        notes: workOrderForm.notes || undefined,
      });
      await mutateWorkOrders();
      await mutateSubscriber();
      setShowWorkOrderModal(false);
      setWorkOrderForm({ type: 'INSTALLATION', scheduledAt: '', technicianName: '', notes: '' });
    } catch (err: any) {
      alert(err.message || 'Failed to create work order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWorkOrderStatus = async (woId: string, action: 'start' | 'complete' | 'cancel') => {
    try {
      const token = await getToken();
      if (!token) return;
      if (action === 'start') await startWorkOrder(token, orgId, woId);
      if (action === 'complete') await completeWorkOrder(token, orgId, woId);
      if (action === 'cancel') await cancelWorkOrder(token, orgId, woId);
      await mutateWorkOrders();
    } catch (err: any) {
      alert(err.message || `Failed to ${action} work order`);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      await createTicket(token, orgId, {
        subscriberId: id,
        subject: ticketForm.subject,
        description: ticketForm.description || undefined,
      });
      await mutateTickets();
      await mutateSubscriber();
      setShowTicketModal(false);
      setTicketForm({ subject: '', description: '' });
    } catch (err: any) {
      alert(err.message || 'Failed to create ticket');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTicketStatus = async (ticketId: string, action: 'start' | 'resolve' | 'close' | 'reopen') => {
    try {
      const token = await getToken();
      if (!token) return;
      if (action === 'start') await startTicket(token, orgId, ticketId);
      if (action === 'resolve') await resolveTicket(token, orgId, ticketId);
      if (action === 'close') await closeTicket(token, orgId, ticketId);
      if (action === 'reopen') await reopenTicket(token, orgId, ticketId);
      await mutateTickets();
    } catch (err: any) {
      alert(err.message || `Failed to ${action} ticket`);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <div className="h-8 w-32 animate-pulse rounded-xl bg-[var(--color-bg-surface)]" />
        <div className="h-28 animate-pulse rounded-2xl bg-[var(--color-bg-surface)]" />
        <div className="h-48 animate-pulse rounded-2xl bg-[var(--color-bg-surface)]" />
      </div>
    );
  }

  if (!subscriber) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <p className="text-[var(--color-text-secondary)]">Subscriber not found.</p>
      </div>
    );
  }

  const TABS: { label: string; value: Tab; icon: React.ReactNode; count?: number }[] = [
    { label: 'Overview', value: 'overview', icon: <Wifi className="h-4 w-4" /> },
    { label: 'Router Control', value: 'router', icon: <Server className="h-4 w-4" /> },
    { label: 'Invoices', value: 'invoices', icon: <FileText className="h-4 w-4" />, count: subscriber._count?.invoices },
    { label: 'Equipment', value: 'equipment', icon: <Package className="h-4 w-4" /> },
    { label: 'Work Orders', value: 'work-orders', icon: <Briefcase className="h-4 w-4" />, count: subscriber._count?.workOrders },
    { label: 'Tickets', value: 'tickets', icon: <TicketCheck className="h-4 w-4" />, count: subscriber._count?.tickets },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto pb-12">
      {/* Back button */}
      <button
        onClick={() => router.push('/subscribers')}
        className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] mb-4 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        All Subscribers
      </button>

      {/* Header card */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 mb-5 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-extrabold">{subscriber.name}</h1>
              <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${STATUS_STYLES[subscriber.status]}`}>
                {subscriber.status}
              </span>
              <button
                onClick={() => setShowEditModal(true)}
                className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg px-2 py-0.5 font-medium">
                {CONN_LABELS[subscriber.connectionType]}
              </span>
              {subscriber.plan ? (
                <span className="text-xs text-[var(--color-accent)] font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                  {subscriber.plan.name} (KES {Number(subscriber.plan.price).toLocaleString()})
                </span>
              ) : (
                <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                  No plan assigned
                </span>
              )}
            </div>
          </div>

          {/* Status actions */}
          <div className="flex items-center gap-2 shrink-0">
            {subscriber.status === 'ACTIVE' && (
              <button
                onClick={() => handleStatusChange('suspend')}
                disabled={actionLoading}
                className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-60"
              >
                Suspend
              </button>
            )}
            {subscriber.status === 'SUSPENDED' && (
              <button
                onClick={() => handleStatusChange('reactivate')}
                disabled={actionLoading}
                className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-60"
              >
                Reactivate
              </button>
            )}
            {subscriber.status !== 'CHURNED' && (
              <button
                onClick={() => handleStatusChange('churn')}
                disabled={actionLoading}
                className="rounded-xl border border-red-200 px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 transition-colors disabled:opacity-60"
              >
                Churn
              </button>
            )}
          </div>
        </div>

        {/* Tappable Contact CTAs — First-class */}
        <div className="flex items-center gap-3 flex-wrap">
          <a
            href={`tel:${subscriber.phone}`}
            className="flex items-center gap-2 rounded-xl bg-[var(--color-bg-base)] border border-[var(--color-border)] px-4 py-2 text-sm font-semibold hover:border-[var(--color-accent)] transition-colors"
          >
            <Phone className="h-4 w-4 text-[var(--color-accent)]" />
            {subscriber.phone}
          </a>
          <a
            href={`https://wa.me/${toWhatsApp(subscriber.phone)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {TABS.map(({ label, value, icon, count }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`flex items-center gap-1.5 shrink-0 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
              tab === value
                ? 'bg-[var(--color-accent)] text-white shadow-sm'
                : 'bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]'
            }`}
          >
            {icon}
            {label}
            {count !== undefined && count > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  tab === value ? 'bg-white/20 text-white' : 'bg-[var(--color-bg-base)] text-[var(--color-text-secondary)]'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
        {/* 1. OVERVIEW TAB */}
        {tab === 'overview' && (
          <div className="space-y-4">
            {subscriber.address && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-[var(--color-text-secondary)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-[var(--color-text-secondary)] mb-0.5">Install Address</p>
                  <p className="text-sm font-medium">{subscriber.address}</p>
                </div>
              </div>
            )}
            {subscriber.email && (
              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-[var(--color-text-secondary)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-[var(--color-text-secondary)] mb-0.5">Email</p>
                  <a href={`mailto:${subscriber.email}`} className="text-sm font-medium text-[var(--color-accent)]">
                    {subscriber.email}
                  </a>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-[var(--color-text-secondary)] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-[var(--color-text-secondary)] mb-0.5">Subscriber Since</p>
                <p className="text-sm font-medium">
                  {new Date(subscriber.createdAt).toLocaleDateString('en-KE', { dateStyle: 'medium' })}
                </p>
              </div>
            </div>
            {subscriber.notes && (
              <div className="rounded-xl bg-[var(--color-bg-base)] border border-[var(--color-border)] p-3">
                <p className="text-xs text-[var(--color-text-secondary)] mb-1">Notes</p>
                <p className="text-sm">{subscriber.notes}</p>
              </div>
            )}
            <div className="pt-2">
              <button
                onClick={() => setShowEditModal(true)}
                className="text-xs text-[var(--color-accent)] font-semibold hover:underline"
              >
                Edit Subscriber Details →
              </button>
            </div>
          </div>
        )}

        {/* ROUTER CONTROL TAB (Phase 6b) */}
        {tab === 'router' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Router State & Access Control</h2>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Live hardware session state on the ISP access router.
                </p>
              </div>
              <button
                onClick={() => setShowRouterLinkModal(true)}
                className="text-xs border border-[var(--color-border)] px-3 py-1.5 rounded-xl font-medium hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors shrink-0"
              >
                {subscriber.router ? 'Change Router Link' : 'Link to Router'}
              </button>
            </div>

            {/* Linked Router Card */}
            {subscriber.router ? (
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-4 sm:p-5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="p-1.5 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-accent)] shrink-0">
                        <Server className="h-4 w-4" />
                      </div>
                      <span className="font-bold text-sm text-[var(--color-text-primary)] truncate">
                        {subscriber.router.label}
                      </span>
                      <span className="text-xs text-[var(--color-text-secondary)] font-mono bg-[var(--color-bg-surface)] px-2 py-0.5 rounded-md border border-[var(--color-border)]">
                        {subscriber.router.host}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] pl-8">
                      Account Reference ({subscriber.connectionType}):{' '}
                      <span className="font-mono font-semibold text-[var(--color-text-primary)]">
                        {subscriber.routerAccountRef || 'Not assigned'}
                      </span>
                    </p>
                  </div>

                  {/* Manual Router Action Buttons — Aligned with Container */}
                  <div className="flex items-center gap-2.5 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-[var(--color-border)]">
                    <button
                      onClick={handleRouterSuspend}
                      disabled={actionLoading}
                      className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                    >
                      <Power className="h-3.5 w-3.5" />
                      <span>Cut / Suspend Session</span>
                    </button>
                    <button
                      onClick={handleRouterReconnect}
                      disabled={actionLoading}
                      className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                    >
                      <Power className="h-3.5 w-3.5" />
                      <span>Restore Session</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 text-[11px] text-[var(--color-text-secondary)] bg-[var(--color-bg-surface)] p-3 rounded-xl border border-[var(--color-border)]">
                  <span className="text-sm leading-none mt-0.5">💡</span>
                  <p className="leading-relaxed">
                    <strong>Live Session Control:</strong> Cutting session immediately disables the PPP Secret or Hotspot User on the MikroTik router. Restoring re-enables it so the subscriber device can re-authenticate.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center">
                <Server className="h-8 w-8 text-[var(--color-text-secondary)] mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No router linked to this subscriber</p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-sm mx-auto">
                  Link this subscriber to a MikroTik access router and specify their PPPoE secret or Hotspot username to enable automated suspension.
                </p>
                <button
                  onClick={() => setShowRouterLinkModal(true)}
                  className="mt-3 bg-[var(--color-accent)] text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold hover:opacity-90"
                >
                  Link Router Now
                </button>
              </div>
            )}

            {/* Action History Log */}
            <div className="pt-3">
              <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
                Recent Router Actions Log
              </h3>
              {routerActions.length === 0 ? (
                <p className="text-xs text-[var(--color-text-secondary)] py-4 text-center">
                  No automated or manual router actions logged yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {routerActions.map((act: any) => (
                    <div
                      key={act.id}
                      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-3 text-xs flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                              act.type === 'SUSPEND'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {act.type}
                          </span>
                          <span className="font-semibold">{act.triggeredBy.toUpperCase()}</span>
                          <span
                            className={`font-bold text-[10px] ${
                              act.status === 'SUCCESS'
                                ? 'text-emerald-600'
                                : act.status === 'FAILED'
                                ? 'text-red-500'
                                : 'text-amber-500'
                            }`}
                          >
                            [{act.status}]
                          </span>
                        </div>
                        {act.lastError && (
                          <p className="text-red-500 mt-1 text-[11px]">Error: {act.lastError}</p>
                        )}
                      </div>
                      <div className="text-right text-[10px] text-[var(--color-text-secondary)]">
                        <p>{new Date(act.createdAt).toLocaleString()}</p>
                        <p>Attempts: {act.attempts}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. INVOICES TAB */}
        {tab === 'invoices' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Billing & Invoices</h2>
              <button
                onClick={handleGenerateInvoice}
                disabled={actionLoading}
                className="flex items-center gap-1 text-xs bg-[var(--color-accent)] text-white px-3 py-1.5 rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="h-3.5 w-3.5" />
                Generate Bill
              </button>
            </div>

            {invoices.length === 0 ? (
              <p className="text-xs text-[var(--color-text-secondary)] text-center py-6">
                No invoices generated yet. Click "Generate Bill" to create a subscription invoice.
              </p>
            ) : (
              <div className="space-y-3">
                {invoices.map((inv) => {
                  const total = Number(inv.adjustmentsTotal) + Number(inv.roomTotal) + Number(inv.consumptionTotal);
                  const paid = Number(inv.amountPaid);
                  const balance = total - paid;

                  return (
                    <div
                      key={inv.id}
                      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-4"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">KES {total.toLocaleString()}</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                inv.status === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : inv.status === 'PARTIAL'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {inv.status}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                            Created {new Date(inv.createdAt).toLocaleDateString('en-KE')}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {inv.status !== 'PAID' && inv.status !== 'VOIDED' && (
                            <>
                              <button
                                onClick={() => {
                                  setShowPaymentModal(inv.id);
                                  setPaymentForm((f) => ({ ...f, amount: String(balance) }));
                                }}
                                className="flex items-center gap-1 text-xs bg-emerald-600 text-white px-2.5 py-1 rounded-lg font-medium hover:bg-emerald-700"
                              >
                                <CreditCard className="h-3 w-3" /> Pay
                              </button>
                              <button
                                onClick={() => setShowLineItemModal(inv.id)}
                                className="text-xs border border-[var(--color-border)] px-2 py-1 rounded-lg text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]"
                              >
                                + Charge
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Line items */}
                      {inv.lineItems && inv.lineItems.length > 0 && (
                        <div className="my-2 border-t border-[var(--color-border)] pt-2 space-y-1">
                          {inv.lineItems.map((li) => (
                            <div key={li.id} className="flex justify-between text-xs text-[var(--color-text-secondary)]">
                              <span>
                                {li.description} (x{Number(li.quantity)})
                              </span>
                              <span>KES {Number(li.total).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Balance info */}
                      <div className="flex items-center justify-between text-xs pt-2 border-t border-[var(--color-border)]">
                        <span className="text-[var(--color-text-secondary)]">
                          Paid: KES {paid.toLocaleString()}
                        </span>
                        <span className={`font-semibold ${balance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                          Balance: KES {balance.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 3. EQUIPMENT TAB */}
        {tab === 'equipment' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Assigned Hardware & Equipment</h2>
              <button
                onClick={() => setShowEquipmentModal(true)}
                className="flex items-center gap-1 text-xs bg-[var(--color-accent)] text-white px-3 py-1.5 rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="h-3.5 w-3.5" />
                Issue Equipment
              </button>
            </div>

            {equipmentList.length === 0 ? (
              <p className="text-xs text-[var(--color-text-secondary)] text-center py-6">
                No equipment recorded for this subscriber yet.
              </p>
            ) : (
              <div className="space-y-3">
                {equipmentList.map((eq) => (
                  <div
                    key={eq.id}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold text-sm">{eq.item?.name}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        Issued: {new Date(eq.createdAt).toLocaleDateString('en-KE')} {eq.reason ? `• ${eq.reason}` : ''}
                      </p>
                    </div>
                    <span className="text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-lg">
                      Qty: {Math.abs(Number(eq.quantityChange))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. WORK ORDERS TAB */}
        {tab === 'work-orders' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Subscriber Work Orders</h2>
              <button
                onClick={() => setShowWorkOrderModal(true)}
                className="flex items-center gap-1 text-xs bg-[var(--color-accent)] text-white px-3 py-1.5 rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="h-3.5 w-3.5" />
                New Job
              </button>
            </div>

            {workOrders.length === 0 ? (
              <p className="text-xs text-[var(--color-text-secondary)] text-center py-6">
                No work orders logged for this subscriber yet.
              </p>
            ) : (
              <div className="space-y-3">
                {workOrders.map((wo) => (
                  <div
                    key={wo.id}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-3"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <span className="font-bold text-sm">{wo.type}</span>
                        <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          {wo.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {wo.status === 'SCHEDULED' && (
                          <button
                            onClick={() => handleWorkOrderStatus(wo.id, 'start')}
                            className="text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded-lg font-bold"
                          >
                            Start
                          </button>
                        )}
                        {wo.status === 'IN_PROGRESS' && (
                          <button
                            onClick={() => handleWorkOrderStatus(wo.id, 'complete')}
                            className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg font-bold"
                          >
                            Complete
                          </button>
                        )}
                      </div>
                    </div>
                    {wo.notes && <p className="text-xs text-[var(--color-text-secondary)] mb-1">{wo.notes}</p>}
                    <p className="text-[10px] text-[var(--color-text-secondary)]">
                      {wo.technicianName ? `Tech: ${wo.technicianName} • ` : ''}
                      {wo.scheduledAt ? `Scheduled: ${new Date(wo.scheduledAt).toLocaleDateString('en-KE')}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. TICKETS TAB */}
        {tab === 'tickets' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Support Tickets</h2>
              <button
                onClick={() => setShowTicketModal(true)}
                className="flex items-center gap-1 text-xs bg-[var(--color-accent)] text-white px-3 py-1.5 rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="h-3.5 w-3.5" />
                Log Ticket
              </button>
            </div>

            {tickets.length === 0 ? (
              <p className="text-xs text-[var(--color-text-secondary)] text-center py-6">
                No tickets logged for this subscriber.
              </p>
            ) : (
              <div className="space-y-3">
                {tickets.map((tk) => (
                  <div
                    key={tk.id}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-3"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <span className="font-bold text-sm">{tk.subject}</span>
                        <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          {tk.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {tk.status === 'OPEN' && (
                          <button
                            onClick={() => handleTicketStatus(tk.id, 'start')}
                            className="text-[10px] bg-amber-50 text-amber-700 px-2 py-1 rounded-lg font-bold"
                          >
                            In Progress
                          </button>
                        )}
                        {tk.status === 'IN_PROGRESS' && (
                          <button
                            onClick={() => handleTicketStatus(tk.id, 'resolve')}
                            className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg font-bold"
                          >
                            Resolve
                          </button>
                        )}
                        {tk.status === 'RESOLVED' && (
                          <button
                            onClick={() => handleTicketStatus(tk.id, 'close')}
                            className="text-[10px] bg-gray-100 text-gray-700 px-2 py-1 rounded-lg font-bold"
                          >
                            Close
                          </button>
                        )}
                      </div>
                    </div>
                    {tk.description && <p className="text-xs text-[var(--color-text-secondary)] mb-1">{tk.description}</p>}
                    <p className="text-[10px] text-[var(--color-text-secondary)]">
                      Logged {new Date(tk.createdAt).toLocaleDateString('en-KE')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base">Edit Subscriber</h2>
              <button onClick={() => setShowEditModal(false)} className="text-[var(--color-text-secondary)] hover:text-red-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubscriber} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Name</label>
                <input
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Phone Number</label>
                <input
                  required
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Assign Plan</label>
                <select
                  value={editForm.planId}
                  onChange={(e) => setEditForm((f) => ({ ...f, planId: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none"
                >
                  <option value="">None</option>
                  {servicePlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - KES {Number(p.price).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Install Address</label>
                <input
                  value={editForm.address}
                  onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Notes</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={actionLoading}
                className="w-full rounded-xl bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-white"
              >
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base">Record Payment</h2>
              <button onClick={() => setShowPaymentModal(null)} className="text-[var(--color-text-secondary)] hover:text-red-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Amount (KES) *</label>
                <input
                  required
                  type="number"
                  min="1"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Payment Method</label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, method: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none"
                >
                  <option value="MPESA">M-Pesa</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card / Bank</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Reference / Note</label>
                <input
                  value={paymentForm.note}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, note: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none"
                  placeholder="e.g. QK89123456 or Handed to technician"
                />
              </div>
              <button
                type="submit"
                disabled={actionLoading}
                className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Record Payment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ADD LINE ITEM MODAL */}
      {showLineItemModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base">Add Charge / Line Item</h2>
              <button onClick={() => setShowLineItemModal(null)} className="text-[var(--color-text-secondary)] hover:text-red-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddLineItem} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Description *</label>
                <input
                  required
                  value={lineItemForm.description}
                  onChange={(e) => setLineItemForm((f) => ({ ...f, description: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none"
                  placeholder="e.g. Router Installation Fee, Static IP add-on"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[var(--color-text-secondary)]">Quantity</label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={lineItemForm.quantity}
                    onChange={(e) => setLineItemForm((f) => ({ ...f, quantity: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--color-text-secondary)]">Unit Price (KES) *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={lineItemForm.unitPrice}
                    onChange={(e) => setLineItemForm((f) => ({ ...f, unitPrice: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none"
                    placeholder="1500"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={actionLoading}
                className="w-full rounded-xl bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-white"
              >
                Add Charge
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ISSUE EQUIPMENT MODAL */}
      {showEquipmentModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base">Issue Hardware / Equipment</h2>
              <button onClick={() => setShowEquipmentModal(false)} className="text-[var(--color-text-secondary)] hover:text-red-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleIssueEquipment} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Pick Item from Inventory *</label>
                <select
                  required
                  value={equipmentForm.itemId}
                  onChange={(e) => setEquipmentForm((f) => ({ ...f, itemId: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none"
                >
                  <option value="">Select equipment...</option>
                  {flatInventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} (In Stock: {Number(item.quantity)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Quantity *</label>
                <input
                  required
                  type="number"
                  min="1"
                  value={equipmentForm.quantity}
                  onChange={(e) => setEquipmentForm((f) => ({ ...f, quantity: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Notes / Serial Number</label>
                <input
                  value={equipmentForm.notes}
                  onChange={(e) => setEquipmentForm((f) => ({ ...f, notes: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none"
                  placeholder="e.g. S/N: SN12389472"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chargeToInvoice"
                  checked={equipmentForm.chargeToInvoice}
                  onChange={(e) => setEquipmentForm((f) => ({ ...f, chargeToInvoice: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="chargeToInvoice" className="text-xs text-[var(--color-text-secondary)]">
                  Charge to subscriber's invoice
                </label>
              </div>
              <button
                type="submit"
                disabled={actionLoading}
                className="w-full rounded-xl bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-white"
              >
                Issue Equipment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* NEW WORK ORDER MODAL */}
      {showWorkOrderModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base">Schedule Work Order</h2>
              <button onClick={() => setShowWorkOrderModal(false)} className="text-[var(--color-text-secondary)] hover:text-red-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateWorkOrder} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Job Type</label>
                <select
                  value={workOrderForm.type}
                  onChange={(e) => setWorkOrderForm((f) => ({ ...f, type: e.target.value as WorkOrderType }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none"
                >
                  <option value="INSTALLATION">Installation</option>
                  <option value="REPAIR">Repair</option>
                  <option value="RELOCATION">Relocation</option>
                  <option value="MAINTENANCE">Maintenance</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[var(--color-text-secondary)]">Scheduled Date</label>
                  <input
                    type="date"
                    value={workOrderForm.scheduledAt}
                    onChange={(e) => setWorkOrderForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--color-text-secondary)]">Technician</label>
                  <input
                    value={workOrderForm.technicianName}
                    onChange={(e) => setWorkOrderForm((f) => ({ ...f, technicianName: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none"
                    placeholder="e.g. Dennis"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Notes</label>
                <textarea
                  value={workOrderForm.notes}
                  onChange={(e) => setWorkOrderForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={actionLoading}
                className="w-full rounded-xl bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-white"
              >
                Schedule Job
              </button>
            </form>
          </div>
        </div>
      )}

      {/* NEW TICKET MODAL */}
      {showTicketModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base">Log Support Ticket</h2>
              <button onClick={() => setShowTicketModal(false)} className="text-[var(--color-text-secondary)] hover:text-red-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTicket} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Subject *</label>
                <input
                  required
                  value={ticketForm.subject}
                  onChange={(e) => setTicketForm((f) => ({ ...f, subject: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none"
                  placeholder="e.g. Slow speeds or intermittent dropouts"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Details</label>
                <textarea
                  value={ticketForm.description}
                  onChange={(e) => setTicketForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none resize-none"
                  placeholder="Describe the complaint or troubleshooting done..."
                />
              </div>
              <button
                type="submit"
                disabled={actionLoading}
                className="w-full rounded-xl bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-white"
              >
                Submit Ticket
              </button>
            </form>
          </div>
        </div>
      )}

      {/* LINK ROUTER MODAL */}
      {showRouterLinkModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base">Link to MikroTik Router</h2>
              <button onClick={() => setShowRouterLinkModal(false)} className="text-[var(--color-text-secondary)] hover:text-red-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleLinkRouter} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Select Router *</label>
                <select
                  required
                  value={routerLinkForm.routerId}
                  onChange={(e) => setRouterLinkForm((f) => ({ ...f, routerId: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none"
                >
                  <option value="">Select a router...</option>
                  {routers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label} ({r.host})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                  Account Reference on Router *
                </label>
                <input
                  required
                  placeholder={
                    subscriber.connectionType === 'HOTSPOT'
                      ? 'e.g. Hotspot username'
                      : 'e.g. PPPoE secret username'
                  }
                  value={routerLinkForm.routerAccountRef}
                  onChange={(e) => setRouterLinkForm((f) => ({ ...f, routerAccountRef: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none font-mono"
                />
                <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
                  Must match the exact username in <code>/ppp/secret</code> or <code>/ip/hotspot/user</code> on the router.
                </p>
              </div>
              <button
                type="submit"
                disabled={actionLoading}
                className="w-full rounded-xl bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              >
                Save Router Link
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
