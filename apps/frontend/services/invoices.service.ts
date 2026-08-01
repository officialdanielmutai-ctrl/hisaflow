import { apiGet, apiPost } from '@/lib/api-client';

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Payment {
  id: string;
  amount: number;
  method: string;
  note?: string | null;
  recordedAt: string;
}

export interface Invoice {
  id: string;
  bookingId: string;
  status: 'DRAFT' | 'ISSUED' | 'PARTIAL' | 'PAID' | 'VOIDED';
  roomTotal: number;
  consumptionTotal: number;
  adjustmentsTotal: number;
  amountPaid: number;
  issuedAt?: string | null;
  lineItems: InvoiceLineItem[];
  payments: Payment[];
}

export const invoicesService = {
  async getDraft(bookingId: string): Promise<Invoice> {
    return apiGet(`/invoices/booking/${bookingId}`);
  },

  async issue(bookingId: string): Promise<Invoice> {
    return apiPost(`/invoices/booking/${bookingId}/issue`);
  },

  async void(bookingId: string): Promise<Invoice> {
    return apiPost(`/invoices/booking/${bookingId}/void`);
  },

  async addLineItem(bookingId: string, description: string, quantity: number, unitPrice: number): Promise<Invoice> {
    return apiPost(`/invoices/booking/${bookingId}/line-items`, { description, quantity, unitPrice });
  },

  async addPayment(bookingId: string, amount: number, method: string, note?: string): Promise<Invoice> {
    return apiPost(`/invoices/booking/${bookingId}/payment`, { amount, method, note });
  },
};
