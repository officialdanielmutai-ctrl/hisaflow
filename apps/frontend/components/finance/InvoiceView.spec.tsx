import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Invoice } from '@/services/invoices.service';
import type { Booking } from '@/services/bookings.service';
import { InvoiceView } from './InvoiceView';

let mockOrganization: Record<string, unknown> = {
  id: 'org_1',
  name: 'Acme Lodge',
  currency: 'KES',
  businessType: 'GUEST_HOUSE',
};

vi.mock('@/hooks/useMyOrganization', () => ({
  useMyOrganization: () => ({ membership: { organization: mockOrganization } }),
}));

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'abc12345-0000',
    bookingId: 'bk_1',
    status: 'PARTIAL',
    roomTotal: 1000,
    consumptionTotal: 160,
    adjustmentsTotal: 0,
    amountPaid: 400,
    lineItems: [],
    payments: [],
    ...overrides,
  } as Invoice;
}

function booking(): Booking {
  return {
    id: 'bk_1',
    roomId: 'room_1',
    guestId: 'guest_1',
    status: 'CHECKED_IN',
    checkInDate: '2026-02-01',
    checkOutDate: '2026-02-03',
    ratePerNight: 500,
    room: { name: 'Room 1', type: 'DOUBLE' },
    guest: { name: 'Alice Wanjiru', phone: '0700000000', email: 'alice@example.com' },
  } as unknown as Booking;
}

describe('InvoiceView', () => {
  beforeEach(() => {
    mockOrganization = {
      id: 'org_1',
      name: 'Acme Lodge',
      currency: 'KES',
      businessType: 'GUEST_HOUSE',
    };
  });

  it('computes the subtotal from room, consumption and adjustments', () => {
    render(<InvoiceView invoice={invoice()} booking={booking()} />);

    // 1000 + 160 + 0 = 1160
    expect(screen.getByText(/KES 1,160/)).toBeInTheDocument();
  });

  it('computes the balance due as subtotal minus amount paid', () => {
    render(<InvoiceView invoice={invoice()} booking={booking()} />);

    // 1160 - 400 = 760
    expect(screen.getByText(/KES 760/)).toBeInTheDocument();
  });

  it('renders the org currency rather than assuming KES', () => {
    mockOrganization = { ...mockOrganization, currency: 'USD' };
    render(<InvoiceView invoice={invoice({ amountPaid: 1160 })} booking={booking()} />);

    expect(screen.getAllByText(/USD 1,160/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/KES/)).not.toBeInTheDocument();
  });

  it('hides the consumption line when there is no consumption', () => {
    render(
      <InvoiceView invoice={invoice({ consumptionTotal: 0 })} booking={booking()} />,
    );

    expect(screen.queryByText(/Food & Beverage/)).not.toBeInTheDocument();
  });

  it('shows payment history only when payments exist', () => {
    const { rerender } = render(<InvoiceView invoice={invoice()} booking={booking()} />);
    expect(screen.queryByText('Payment History')).not.toBeInTheDocument();

    rerender(
      <InvoiceView
        invoice={invoice({
          payments: [
            { id: 'p1', amount: 400, method: 'MPESA', note: 'deposit', recordedAt: '2026-02-01T09:00:00.000Z' },
          ],
        })}
        booking={booking()}
      />,
    );

    expect(screen.getByText('Payment History')).toBeInTheDocument();
    expect(screen.getByText(/MPESA/)).toBeInTheDocument();
  });
});
