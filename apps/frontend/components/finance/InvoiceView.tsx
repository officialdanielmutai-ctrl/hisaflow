'use client';

import React from 'react';
import { type Invoice } from '@/services/invoices.service';
import { type Booking } from '@/services/bookings.service';
import { useMyOrganization } from '@/hooks/useMyOrganization';

export function InvoiceView({
  invoice,
  booking,
}: {
  invoice: Invoice;
  booking: Booking;
}) {
  const { membership } = useMyOrganization();
  const org = membership?.organization;
  const currency = org?.currency || 'KES';

  const invoiceTotal =
    Number(invoice.roomTotal) +
    Number(invoice.consumptionTotal) +
    Number(invoice.adjustmentsTotal);
  const balance = invoiceTotal - Number(invoice.amountPaid);

  return (
    <div className="bg-white p-8 max-w-3xl mx-auto shadow-sm border border-gray-100 rounded-2xl print:shadow-none print:border-none print:m-0 print:p-0">
      {/* Header */}
      <div className="flex justify-between items-start border-b border-gray-100 pb-8 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            {org?.name || 'Guest House'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {org?.businessType === 'GUEST_HOUSE' ? 'Guest House' : 'Lodge'}
          </p>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-semibold text-gray-300 uppercase tracking-widest mb-2">
            INVOICE
          </h2>
          <p className="text-sm font-medium text-gray-900">
            INV-{invoice.id.split('-')[0].toUpperCase()}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Date: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Booking Details */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            Billed To
          </h3>
          <p className="text-sm font-semibold text-gray-900">{booking.guest?.name}</p>
          {booking.guest?.phone && (
            <p className="text-sm text-gray-500">{booking.guest.phone}</p>
          )}
          {booking.guest?.email && (
            <p className="text-sm text-gray-500">{booking.guest.email}</p>
          )}
        </div>
        <div className="text-right">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            Stay Details
          </h3>
          <p className="text-sm font-semibold text-gray-900">
            {booking.room?.name} ({booking.room?.type})
          </p>
          <p className="text-sm text-gray-500">
            Check-in: {new Date(booking.checkInDate).toLocaleDateString()}
          </p>
          <p className="text-sm text-gray-500">
            Check-out: {new Date(booking.checkOutDate).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Line Items Table */}
      <table className="w-full mb-8 text-left border-collapse">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
              Description
            </th>
            <th className="py-3 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">
              Qty
            </th>
            <th className="py-3 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">
              Rate
            </th>
            <th className="py-3 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          <tr>
            <td className="py-4 text-sm text-gray-900 font-medium">Room Charges</td>
            <td className="py-4 text-sm text-gray-500 text-right">—</td>
            <td className="py-4 text-sm text-gray-500 text-right">—</td>
            <td className="py-4 text-sm text-gray-900 text-right font-medium">
              {Number(invoice.roomTotal).toLocaleString()}
            </td>
          </tr>
          {Number(invoice.consumptionTotal) > 0 && (
            <tr>
              <td className="py-4 text-sm text-gray-900 font-medium">
                Food & Beverage (Consumption)
              </td>
              <td className="py-4 text-sm text-gray-500 text-right">—</td>
              <td className="py-4 text-sm text-gray-500 text-right">—</td>
              <td className="py-4 text-sm text-gray-900 text-right font-medium">
                {Number(invoice.consumptionTotal).toLocaleString()}
              </td>
            </tr>
          )}
          {invoice.lineItems?.map((item) => (
            <tr key={item.id}>
              <td className="py-4 text-sm text-gray-900 font-medium">
                {item.description}
              </td>
              <td className="py-4 text-sm text-gray-500 text-right">
                {item.quantity}
              </td>
              <td className="py-4 text-sm text-gray-500 text-right">
                {Number(item.unitPrice).toLocaleString()}
              </td>
              <td className="py-4 text-sm text-gray-900 text-right font-medium">
                {Number(item.total).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-64 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 font-medium">Subtotal</span>
            <span className="text-gray-900 font-medium">
              {currency} {invoiceTotal.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-sm text-green-600">
            <span className="font-medium">Total Paid</span>
            <span className="font-medium">
              -{currency} {Number(invoice.amountPaid).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-base font-bold pt-3 border-t border-gray-100">
            <span className="text-gray-900">Balance Due</span>
            <span className={balance > 0 ? 'text-red-600' : 'text-gray-900'}>
              {currency} {balance.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Payment History */}
      {invoice.payments?.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">
            Payment History
          </h3>
          <div className="space-y-2">
            {invoice.payments.map((p) => (
              <div key={p.id} className="flex justify-between text-xs text-gray-500">
                <span>
                  {new Date(p.recordedAt).toLocaleDateString()} - {p.method}
                  {p.note ? ` (${p.note})` : ''}
                </span>
                <span className="font-medium text-gray-900">
                  {currency} {Number(p.amount).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-16 pt-8 border-t border-gray-100 text-center text-xs text-gray-400">
        <p>Thank you for choosing {org?.name}!</p>
        <p className="mt-1">Please retain this receipt for your records.</p>
      </div>
    </div>
  );
}
