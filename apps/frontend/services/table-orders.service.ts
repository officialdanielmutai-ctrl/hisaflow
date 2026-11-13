import { apiGet, apiPost } from '@/lib/api-client';

export interface TableOrderItem {
  id: string;
  orderId: string;
  itemId: string;
  quantity: number;
  unitPrice: number;
  notes?: string | null;
  item?: {
    id: string;
    name: string;
    unit: string;
  };
}

export interface TableOrder {
  id: string;
  tableLabel: string;
  status: 'OPEN' | 'PAID' | 'VOIDED';
  notes?: string | null;
  openedAt: string;
  closedAt?: string | null;
  items: TableOrderItem[];
}

export interface CreateTableOrderPayload {
  tableLabel: string;
  notes?: string;
  items?: {
    itemId: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
  }[];
}

export function getTableOrders(
  token: string,
  organizationId: string,
): Promise<TableOrder[]> {
  return apiGet<TableOrder[]>('/table-orders', token, organizationId);
}

export function createTableOrder(
  payload: CreateTableOrderPayload,
  token: string,
  organizationId: string,
): Promise<TableOrder> {
  return apiPost<TableOrder>('/table-orders', token, organizationId, payload);
}

export function addTableOrderItem(
  orderId: string,
  payload: { itemId: string; quantity: number; unitPrice: number; notes?: string },
  token: string,
  organizationId: string,
): Promise<TableOrderItem> {
  return apiPost<TableOrderItem>(
    `/table-orders/${orderId}/items`,
    token,
    organizationId,
    payload,
  );
}

export function closeTableOrder(
  orderId: string,
  token: string,
  organizationId: string,
): Promise<TableOrder> {
  return apiPost<TableOrder>(
    `/table-orders/${orderId}/close`,
    token,
    organizationId,
    {},
  );
}
