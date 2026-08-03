'use client';

import React from 'react';
import useSWR from 'swr';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { bookingsService, type Booking } from '@/services/bookings.service';
import { invoicesService, type Invoice } from '@/services/invoices.service';
import { InvoiceView } from '@/components/finance/InvoiceView';
import { Loader2, Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const orgId = membership?.organization?.id;

  const { data: booking, isLoading: loadingBooking } = useSWR<Booking>(
    orgId ? `booking-${id}` : null,
    async () => {
      const token = await getToken();
      if (!token || !orgId) throw new Error('Not authenticated');
      return bookingsService.getById(id, token, orgId);
    }
  );

  const { data: invoice, isLoading: loadingInvoice } = useSWR<Invoice>(
    orgId && booking ? `invoice-${id}` : null,
    async () => {
      const token = await getToken();
      if (!token || !orgId) throw new Error('Not authenticated');
      return invoicesService.getDraft(id, token, orgId);
    }
  );

  if (loadingBooking || loadingInvoice) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (!booking || !invoice) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4 text-center">
        <p className="text-gray-500 mb-4">Could not load invoice data.</p>
        <Link href={`/bookings/${id}`} className="text-[var(--color-primary)] font-medium hover:underline">
          Return to Booking
        </Link>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-50/50 pb-24 print:bg-white print:pb-0">
      {/* Top Bar (Hidden in Print) */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10 print:hidden">
        <Link
          href={`/bookings/${id}`}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
        >
          <Printer className="h-4 w-4" />
          Print Receipt
        </button>
      </div>

      <div className="p-4 sm:p-8 print:p-0">
        <InvoiceView booking={booking} invoice={invoice} />
      </div>
    </div>
  );
}
