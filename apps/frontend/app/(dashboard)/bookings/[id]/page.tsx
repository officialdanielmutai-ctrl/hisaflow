'use client';

import React, { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { useRole } from '@/hooks/useRole';
import useSWR from 'swr';
import { bookingsService, type Booking } from '@/services/bookings.service';
import { invoicesService, type Invoice } from '@/services/invoices.service';
import { getInventoryItems, type InventoryItem } from '@/services/inventory.service';
import {
  ArrowLeft, Bed, User, CalendarDays, LogIn, LogOut, Package,
  Plus, Loader2, AlertTriangle, FileText, CreditCard, Check, X
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const STATUS_COLORS: Record<string, string> = {
  RESERVED: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  CHECKED_IN: 'bg-green-100 text-green-700 border-green-200',
  CHECKED_OUT: 'bg-gray-100 text-gray-600 border-gray-200',
  CANCELLED: 'bg-red-100 text-red-600 border-red-200',
  NO_SHOW: 'bg-orange-100 text-orange-600 border-orange-200',
};

const INVOICE_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  ISSUED: 'bg-blue-100 text-blue-700',
  PARTIAL: 'bg-yellow-100 text-yellow-700',
  PAID: 'bg-green-100 text-green-700',
  VOIDED: 'bg-red-100 text-red-600',
};

function AddConsumptionModal({
  bookingId, token, orgId, onClose, onSuccess
}: {
  bookingId: string; token: string; orgId: string;
  onClose: () => void; onSuccess: () => void;
}) {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: items } = useSWR<InventoryItem[]>(
    'inventory-items',
    async () => {
      const t = await getToken();
      if (!t || !membership) throw new Error('');
      const products = await getInventoryItems(t, membership.organization.id);
      // Flatten products -> variants for the consumption dropdown
      return products.flatMap((p) => p.variants);
    }
  );

  const handleAdd = async () => {
    if (!itemId || !quantity) return;
    setLoading(true);
    setError('');
    try {
      await bookingsService.addConsumption(bookingId, itemId, Number(quantity), token, orgId);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to log consumption');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-900 text-lg">Log Room Consumption</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        {error && <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-xl">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
            <select
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-sm"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
            >
              <option value="">Select an item...</option>
              {items?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} (qty: {item.quantity} {item.unit})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Used</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-sm"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <button
            onClick={handleAdd}
            disabled={loading || !itemId}
            className="w-full py-3 rounded-xl text-white font-medium bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-40 flex items-center justify-center"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Log Consumption'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddChargeModal({
  bookingId, orgId, onClose, onSuccess
}: {
  bookingId: string; orgId: string;
  onClose: () => void; onSuccess: () => void;
}) {
  const { getToken } = useAuth();
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async () => {
    if (!description || !unitPrice) return;
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await invoicesService.addLineItem(bookingId, description, Number(quantity), Number(unitPrice), token, orgId);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to add charge');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-900 text-lg">Add Custom Charge</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        {error && <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-xl">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              placeholder="e.g. Laundry, Airport Transfer, Damages..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                step="1"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-sm"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-sm"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={loading || !description || !unitPrice}
            className="w-full py-3 rounded-xl text-white font-medium bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-40 flex items-center justify-center"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Add Charge'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddPaymentModal({
  bookingId, orgId, onClose, onSuccess
}: {
  bookingId: string; orgId: string;
  onClose: () => void; onSuccess: () => void;
}) {
  const { getToken } = useAuth();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePay = async () => {
    if (!amount) return;
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await invoicesService.addPayment(bookingId, Number(amount), method, token, orgId, note || undefined);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to record payment');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-900 text-lg">Record Payment</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        {error && <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-xl">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <input
              type="number"
              min="1"
              step="0.01"
              placeholder="0.00"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-sm"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {['CASH', 'MPESA', 'CARD'].map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                    method === m
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Deposit, Balance payment..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-sm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <button
            onClick={handlePay}
            disabled={loading || !amount}
            className="w-full py-3 rounded-xl text-white font-medium bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-40 flex items-center justify-center"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirm Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const { isOwner, isManager } = useRole();

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showConsumption, setShowConsumption] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showCharge, setShowCharge] = useState(false);
  const [tokenCache, setTokenCache] = useState<string | null>(null);

  const orgId = membership?.organization?.id ?? '';
  const currency = membership?.organization?.currency || 'KES';

  const { data: booking, mutate: mutateBooking, isLoading } = useSWR<Booking>(
    membership ? `booking-${id}` : null,
    async () => {
      const token = await getToken();
      if (!token || !membership) throw new Error('Not authenticated');
      setTokenCache(token);
      return bookingsService.getById(id, token, membership.organization.id);
    }
  );

  const { data: invoice, mutate: mutateInvoice } = useSWR<Invoice>(
    booking && booking.status !== 'CANCELLED'
      ? `invoice-${id}`
      : null,
    async () => {
      const token = await getToken();
      if (!token || !membership) throw new Error('Not authenticated');
      return invoicesService.getDraft(id, token, membership.organization.id);
    }
  );

  const getToken_ = async () => {
    const t = await getToken();
    setTokenCache(t);
    return t!;
  };

  const doAction = async (action: string, fn: (token: string) => Promise<void>) => {
    setActionLoading(action);
    setError('');
    try {
      const t = await getToken_();
      await fn(t);
      mutateBooking();
      mutateInvoice();
    } catch (err: any) {
      setError(err.message || `Failed to ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (!booking) {
    return <div className="p-6 text-center text-gray-500">Booking not found.</div>;
  }

  const canCheckIn = booking.status === 'RESERVED';
  const canCheckOut = booking.status === 'CHECKED_IN';
  const isCheckedIn = booking.status === 'CHECKED_IN';
  const isFinished = ['CHECKED_OUT', 'CANCELLED', 'NO_SHOW'].includes(booking.status);

  const invoiceTotal = invoice
    ? Number(invoice.roomTotal) + Number(invoice.consumptionTotal) + Number(invoice.adjustmentsTotal)
    : 0;
  const invoiceBalance = invoiceTotal - Number(invoice?.amountPaid ?? 0);

  return (
    <div className="flex flex-col h-full bg-gray-50/50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/bookings" className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{booking.guest?.name ?? 'Booking'}</h1>
            <p className="text-sm text-gray-500">{booking.room?.name} · {booking.room?.type}</p>
          </div>
          <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${STATUS_COLORS[booking.status]}`}>
            {booking.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-start gap-3 border border-red-100">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Booking Info Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Booking Details</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <div className="bg-gray-50 p-2 rounded-lg"><User className="h-4 w-4 text-gray-500" /></div>
              <div>
                <div className="text-xs text-gray-500">Guest</div>
                <div className="font-medium text-gray-900">{booking.guest?.name}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="bg-gray-50 p-2 rounded-lg"><Bed className="h-4 w-4 text-gray-500" /></div>
              <div>
                <div className="text-xs text-gray-500">Room</div>
                <div className="font-medium text-gray-900">{booking.room?.name} · {booking.room?.type}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="bg-gray-50 p-2 rounded-lg"><CalendarDays className="h-4 w-4 text-gray-500" /></div>
              <div>
                <div className="text-xs text-gray-500">Scheduled Stay</div>
                <div className="font-medium text-gray-900">
                  {new Date(booking.checkInDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                  {' → '}
                  {new Date(booking.checkOutDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            </div>
            <div className="pt-2 border-t border-gray-50 flex items-center justify-between text-sm">
              <span className="text-gray-500">Rate per Night</span>
              <span className="font-bold text-gray-900">{currency} {Number(booking.ratePerNight).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        {!isFinished && (
          <div className="grid grid-cols-2 gap-3">
            {canCheckIn && (
              <button
                onClick={() => doAction('check-in', (t) => bookingsService.checkIn(id, t, orgId).then(() => {}))}
                disabled={actionLoading === 'check-in'}
                className="col-span-2 flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-500 text-white font-semibold hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                {actionLoading === 'check-in' ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                Check In Guest
              </button>
            )}
            {canCheckOut && (
              <button
                onClick={() => doAction('check-out', (t) => bookingsService.checkOut(id, false, t, orgId).then(() => {}))}
                disabled={actionLoading === 'check-out'}
                className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-500 text-white font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {actionLoading === 'check-out' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                Check Out
              </button>
            )}
            {isCheckedIn && (
              <button
                onClick={() => setShowConsumption(true)}
                className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
              >
                <Package className="h-4 w-4" />
                Add Item
              </button>
            )}
            {!isCheckedIn && canCheckIn && (isOwner || isManager) && (
              <button
                onClick={() => doAction('cancel', (t) => bookingsService.cancel(id, t, orgId).then(() => {}))}
                disabled={!!actionLoading}
                className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-50 text-red-600 font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {actionLoading === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                Cancel
              </button>
            )}
          </div>
        )}

        {/* Invoice Panel */}
        {invoice && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--color-primary)]" />
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Invoice</h3>
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${INVOICE_STATUS_COLORS[invoice.status]}`}>
                {invoice.status}
              </span>
            </div>

            <div className="space-y-2 text-sm border-b border-gray-50 pb-4 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-500">Room Charges</span>
                <span className="font-medium">{currency} {Number(invoice.roomTotal).toLocaleString()}</span>
              </div>
              {Number(invoice.consumptionTotal) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Consumption</span>
                  <span className="font-medium">{currency} {Number(invoice.consumptionTotal).toLocaleString()}</span>
                </div>
              )}
              {invoice.lineItems?.length > 0 && (
                <>
                  <div className="pt-1 pb-0.5">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Additional Charges</span>
                  </div>
                  {invoice.lineItems.map((item) => (
                    <div key={item.id} className="flex justify-between pl-2">
                      <span className="text-gray-600">{item.description}</span>
                      <span className="font-medium">{currency} {Number(item.total).toLocaleString()}</span>
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>{currency} {invoiceTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Paid</span>
                <span className="font-medium">{currency} {Number(invoice.amountPaid).toLocaleString()}</span>
              </div>
              <div className={`flex justify-between font-bold ${invoiceBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                <span>Balance</span>
                <span>{currency} {invoiceBalance.toLocaleString()}</span>
              </div>
            </div>

            {/* Payment History */}
            {invoice.payments?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Payment History</p>
                <div className="space-y-2">
                  {invoice.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-xs text-gray-600">
                      <div className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-green-500" />
                        <span>{p.method}</span>
                        {p.note && <span className="text-gray-400">· {p.note}</span>}
                      </div>
                      <span className="font-semibold">{currency} {Number(p.amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Invoice Actions */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              {invoice.status !== 'PAID' && invoice.status !== 'VOIDED' && (
                <button
                  onClick={() => setShowPayment(true)}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity col-span-2"
                >
                  <CreditCard className="h-4 w-4" />
                  Record Payment
                </button>
              )}
              {(isOwner || isManager) && invoice.status !== 'VOIDED' && invoice.status !== 'PAID' && (
                <button
                  onClick={() => setShowCharge(true)}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Charge
                </button>
              )}
              {(isOwner || isManager) && invoice.status === 'DRAFT' && (
                <button
                  onClick={() => doAction('issue', (t) => invoicesService.issue(id, t, orgId).then(() => {}))}
                  disabled={!!actionLoading}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  {actionLoading === 'issue' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  Issue Invoice
                </button>
              )}
              {invoice.status !== 'DRAFT' && (
                <Link
                  href={`/bookings/${id}/invoice`}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors ${!(isOwner || isManager) ? 'col-span-2' : ''}`}
                >
                  <FileText className="h-4 w-4" />
                  View Receipt
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        {booking.notes && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2">Notes</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{booking.notes}</p>
          </div>
        )}
      </div>

      {showConsumption && tokenCache && (
        <AddConsumptionModal
          bookingId={id}
          token={tokenCache}
          orgId={orgId}
          onClose={() => setShowConsumption(false)}
          onSuccess={() => {
            setShowConsumption(false);
            mutateBooking();
            mutateInvoice();
          }}
        />
      )}

      {showPayment && (
        <AddPaymentModal
          bookingId={id}
          orgId={orgId}
          onClose={() => setShowPayment(false)}
          onSuccess={() => {
            setShowPayment(false);
            mutateBooking();
            mutateInvoice();
          }}
        />
      )}

      {showCharge && (
        <AddChargeModal
          bookingId={id}
          orgId={orgId}
          onClose={() => setShowCharge(false)}
          onSuccess={() => {
            setShowCharge(false);
            mutateBooking();
            mutateInvoice();
          }}
        />
      )}
    </div>
  );
}
