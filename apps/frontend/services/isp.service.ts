import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';

export type SubscriberStatus = 'ACTIVE' | 'SUSPENDED' | 'CHURNED';
export type ConnectionType = 'PPPOE' | 'HOTSPOT' | 'STATIC_IP';
export type BillingCycle = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
export type WorkOrderType = 'INSTALLATION' | 'REPAIR' | 'RELOCATION' | 'MAINTENANCE';
export type WorkOrderStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIAL' | 'PAID' | 'VOIDED';

export interface IspDashboardData {
  subscribers: {
    total: number;
    active: number;
    suspended: number;
    churned: number;
    activeRate: number;
  };
  openTickets: number;
  scheduledWorkOrders: number;
  monthlyRevenue: number;
}

export function getIspDashboard(token: string, orgId: string): Promise<IspDashboardData> {
  return apiGet<IspDashboardData>('/isp/dashboard', token, orgId);
}

export interface ServicePlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  billingCycle: BillingCycle;
  connectionType: ConnectionType;
  speedMbps?: number;
  isActive: boolean;
  createdAt: string;
  _count?: {
    subscribers: number;
  };
}

export interface Subscriber {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  connectionType: ConnectionType;
  status: SubscriberStatus;
  planId?: string;
  plan?: ServicePlan;
  routerId?: string;
  routerAccountRef?: string;
  router?: {
    id: string;
    label: string;
    host: string;
    connectionStatus: string;
  };
  notes?: string;
  createdAt: string;
  _count?: {
    invoices: number;
    workOrders: number;
    tickets: number;
  };
}

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: string;
  note?: string;
  recordedAt: string;
}

export interface IspInvoice {
  id: string;
  organizationId: string;
  subscriberId: string;
  planId?: string;
  status: InvoiceStatus;
  roomTotal: number;
  consumptionTotal: number;
  adjustmentsTotal: number;
  amountPaid: number;
  issuedAt?: string;
  createdAt: string;
  plan?: ServicePlan;
  subscriber?: Subscriber;
  lineItems: InvoiceLineItem[];
  payments: Payment[];
}

export interface EquipmentTransaction {
  id: string;
  itemId: string;
  quantityBefore: number;
  quantityChange: number;
  quantityAfter: number;
  reason?: string;
  subscriberId?: string;
  workOrderId?: string;
  createdAt: string;
  item: {
    id: string;
    name: string;
    sku?: string;
    sellingPrice?: number;
    costPrice?: number;
    unit?: string;
  };
  workOrder?: {
    id: string;
    type: WorkOrderType;
    status: WorkOrderStatus;
  };
}

export interface WorkOrder {
  id: string;
  organizationId: string;
  subscriberId: string;
  type: WorkOrderType;
  status: WorkOrderStatus;
  scheduledAt?: string;
  completedAt?: string;
  technicianName?: string;
  notes?: string;
  createdAt: string;
  subscriber: {
    id: string;
    name: string;
    phone: string;
    address?: string;
    plan?: { id: string; name: string; speedMbps?: number };
  };
  equipmentUsed?: EquipmentTransaction[];
}

export interface Ticket {
  id: string;
  organizationId: string;
  subscriberId: string;
  subject: string;
  description?: string;
  status: TicketStatus;
  resolvedAt?: string;
  createdAt: string;
  subscriber: {
    id: string;
    name: string;
    phone: string;
  };
}

// ── 1. SUBSCRIBERS ──────────────────────────────────────────────

export async function getSubscribers(
  token: string,
  orgId: string,
  status?: SubscriberStatus,
  planId?: string,
): Promise<Subscriber[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (planId) params.set('planId', planId);
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiGet<Subscriber[]>(`/subscribers${query}`, token, orgId);
}

export async function getSubscriber(
  token: string,
  orgId: string,
  id: string,
): Promise<Subscriber> {
  return apiGet<Subscriber>(`/subscribers/${id}`, token, orgId);
}

export async function createSubscriber(
  token: string,
  orgId: string,
  data: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
    connectionType?: ConnectionType;
    planId?: string;
    notes?: string;
  },
): Promise<Subscriber> {
  return apiPost<Subscriber>('/subscribers', token, orgId, data);
}

export async function updateSubscriber(
  token: string,
  orgId: string,
  id: string,
  data: Partial<Subscriber>,
): Promise<Subscriber> {
  return apiPatch<Subscriber>(`/subscribers/${id}`, token, orgId, data);
}

export async function suspendSubscriber(token: string, orgId: string, id: string): Promise<Subscriber> {
  return apiPatch<Subscriber>(`/subscribers/${id}/suspend`, token, orgId, {});
}

export async function reactivateSubscriber(token: string, orgId: string, id: string): Promise<Subscriber> {
  return apiPatch<Subscriber>(`/subscribers/${id}/reactivate`, token, orgId, {});
}

export async function churnSubscriber(token: string, orgId: string, id: string): Promise<Subscriber> {
  return apiPatch<Subscriber>(`/subscribers/${id}/churn`, token, orgId, {});
}

// ── Router Actions (Phase 6b) ────────────────────────────────────

export async function linkSubscriberRouter(
  token: string,
  orgId: string,
  id: string,
  routerId: string,
  routerAccountRef: string,
): Promise<Subscriber> {
  return apiPatch<Subscriber>(`/subscribers/${id}/router-link`, token, orgId, { routerId, routerAccountRef });
}

export async function routerSuspendSubscriber(
  token: string,
  orgId: string,
  id: string,
): Promise<{ success: boolean; actionId: string; error?: string }> {
  return apiPost<{ success: boolean; actionId: string; error?: string }>(
    `/subscribers/${id}/router-suspend`,
    token,
    orgId,
    {},
  );
}

export async function routerReconnectSubscriber(
  token: string,
  orgId: string,
  id: string,
): Promise<{ success: boolean; actionId: string; error?: string }> {
  return apiPost<{ success: boolean; actionId: string; error?: string }>(
    `/subscribers/${id}/router-reconnect`,
    token,
    orgId,
    {},
  );
}

export async function getSubscriberRouterActions(
  token: string,
  orgId: string,
  id: string,
): Promise<any[]> {
  return apiGet<any[]>(`/subscribers/${id}/router-actions`, token, orgId);
}

// ── 2. SERVICE PLANS ────────────────────────────────────────────

export async function getServicePlans(
  token: string,
  orgId: string,
  activeOnly?: boolean,
): Promise<ServicePlan[]> {
  const query = activeOnly !== undefined ? `?activeOnly=${activeOnly}` : '';
  return apiGet<ServicePlan[]>(`/service-plans${query}`, token, orgId);
}

export async function getServicePlan(
  token: string,
  orgId: string,
  id: string,
): Promise<ServicePlan> {
  return apiGet<ServicePlan>(`/service-plans/${id}`, token, orgId);
}

export async function createServicePlan(
  token: string,
  orgId: string,
  data: {
    name: string;
    description?: string;
    price: number;
    billingCycle?: BillingCycle;
    connectionType?: ConnectionType;
    speedMbps?: number;
  },
): Promise<ServicePlan> {
  return apiPost<ServicePlan>('/service-plans', token, orgId, data);
}

export async function updateServicePlan(
  token: string,
  orgId: string,
  id: string,
  data: Partial<ServicePlan>,
): Promise<ServicePlan> {
  return apiPatch<ServicePlan>(`/service-plans/${id}`, token, orgId, data);
}

export async function deleteServicePlan(
  token: string,
  orgId: string,
  id: string,
): Promise<ServicePlan> {
  return apiDelete<ServicePlan>(`/service-plans/${id}`, token, orgId);
}

// ── 3. INVOICES & PAYMENTS ───────────────────────────────────────

export async function generateIspInvoice(
  token: string,
  orgId: string,
  data: { subscriberId: string; planId?: string; notes?: string },
): Promise<IspInvoice> {
  return apiPost<IspInvoice>('/isp-invoices/generate', token, orgId, data);
}

export async function getIspInvoicesBySubscriber(
  token: string,
  orgId: string,
  subscriberId: string,
): Promise<IspInvoice[]> {
  return apiGet<IspInvoice[]>(`/isp-invoices/subscriber/${subscriberId}`, token, orgId);
}

export async function getIspInvoice(
  token: string,
  orgId: string,
  id: string,
): Promise<IspInvoice> {
  return apiGet<IspInvoice>(`/isp-invoices/${id}`, token, orgId);
}

export async function addIspLineItem(
  token: string,
  orgId: string,
  invoiceId: string,
  data: { description: string; quantity: number; unitPrice: number },
): Promise<IspInvoice> {
  return apiPost<IspInvoice>(`/isp-invoices/${invoiceId}/line-items`, token, orgId, data);
}

export async function recordIspPayment(
  token: string,
  orgId: string,
  invoiceId: string,
  data: { amount: number; method: string; note?: string },
): Promise<IspInvoice> {
  return apiPost<IspInvoice>(`/isp-invoices/${invoiceId}/payments`, token, orgId, data);
}

export async function issueIspInvoice(token: string, orgId: string, id: string): Promise<IspInvoice> {
  return apiPost<IspInvoice>(`/isp-invoices/${id}/issue`, token, orgId, {});
}

export async function voidIspInvoice(token: string, orgId: string, id: string): Promise<IspInvoice> {
  return apiPost<IspInvoice>(`/isp-invoices/${id}/void`, token, orgId, {});
}

// ── 4. EQUIPMENT / HARDWARE ─────────────────────────────────────

export async function issueEquipment(
  token: string,
  orgId: string,
  data: {
    subscriberId: string;
    itemId: string;
    quantity: number;
    workOrderId?: string;
    notes?: string;
    chargeToInvoice?: boolean;
  },
): Promise<EquipmentTransaction> {
  return apiPost<EquipmentTransaction>('/isp-equipment/issue', token, orgId, data);
}

export async function getEquipmentBySubscriber(
  token: string,
  orgId: string,
  subscriberId: string,
): Promise<EquipmentTransaction[]> {
  return apiGet<EquipmentTransaction[]>(`/isp-equipment/subscriber/${subscriberId}`, token, orgId);
}

export async function getEquipmentByWorkOrder(
  token: string,
  orgId: string,
  workOrderId: string,
): Promise<EquipmentTransaction[]> {
  return apiGet<EquipmentTransaction[]>(`/isp-equipment/work-order/${workOrderId}`, token, orgId);
}

// ── 5. WORK ORDERS ──────────────────────────────────────────────

export async function getWorkOrders(
  token: string,
  orgId: string,
  status?: WorkOrderStatus,
  subscriberId?: string,
): Promise<WorkOrder[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (subscriberId) params.set('subscriberId', subscriberId);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiGet<WorkOrder[]>(`/work-orders${qs}`, token, orgId);
}

export async function getWorkOrder(
  token: string,
  orgId: string,
  id: string,
): Promise<WorkOrder> {
  return apiGet<WorkOrder>(`/work-orders/${id}`, token, orgId);
}

export async function createWorkOrder(
  token: string,
  orgId: string,
  data: {
    subscriberId: string;
    type: WorkOrderType;
    scheduledAt?: string;
    technicianName?: string;
    notes?: string;
  },
): Promise<WorkOrder> {
  return apiPost<WorkOrder>('/work-orders', token, orgId, data);
}

export async function updateWorkOrder(
  token: string,
  orgId: string,
  id: string,
  data: Partial<WorkOrder>,
): Promise<WorkOrder> {
  return apiPatch<WorkOrder>(`/work-orders/${id}`, token, orgId, data);
}

export async function startWorkOrder(token: string, orgId: string, id: string): Promise<WorkOrder> {
  return apiPatch<WorkOrder>(`/work-orders/${id}/start`, token, orgId, {});
}

export async function completeWorkOrder(token: string, orgId: string, id: string): Promise<WorkOrder> {
  return apiPatch<WorkOrder>(`/work-orders/${id}/complete`, token, orgId, {});
}

export async function cancelWorkOrder(token: string, orgId: string, id: string): Promise<WorkOrder> {
  return apiPatch<WorkOrder>(`/work-orders/${id}/cancel`, token, orgId, {});
}

// ── 6. SUPPORT TICKETS ──────────────────────────────────────────

export async function getTickets(
  token: string,
  orgId: string,
  status?: TicketStatus,
  subscriberId?: string,
): Promise<Ticket[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (subscriberId) params.set('subscriberId', subscriberId);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiGet<Ticket[]>(`/tickets${qs}`, token, orgId);
}

export async function getTicket(
  token: string,
  orgId: string,
  id: string,
): Promise<Ticket> {
  return apiGet<Ticket>(`/tickets/${id}`, token, orgId);
}

export async function createTicket(
  token: string,
  orgId: string,
  data: {
    subscriberId: string;
    subject: string;
    description?: string;
  },
): Promise<Ticket> {
  return apiPost<Ticket>('/tickets', token, orgId, data);
}

export async function updateTicket(
  token: string,
  orgId: string,
  id: string,
  data: Partial<Ticket>,
): Promise<Ticket> {
  return apiPatch<Ticket>(`/tickets/${id}`, token, orgId, data);
}

export async function startTicket(token: string, orgId: string, id: string): Promise<Ticket> {
  return apiPatch<Ticket>(`/tickets/${id}/start`, token, orgId, {});
}

export async function resolveTicket(token: string, orgId: string, id: string): Promise<Ticket> {
  return apiPatch<Ticket>(`/tickets/${id}/resolve`, token, orgId, {});
}

export async function closeTicket(token: string, orgId: string, id: string): Promise<Ticket> {
  return apiPatch<Ticket>(`/tickets/${id}/close`, token, orgId, {});
}

export async function reopenTicket(token: string, orgId: string, id: string): Promise<Ticket> {
  return apiPatch<Ticket>(`/tickets/${id}/reopen`, token, orgId, {});
}
