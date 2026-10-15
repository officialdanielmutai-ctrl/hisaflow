import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { FinanceBreakdown } from '@/services/business-finance.service';
import { FinanceBreakdownPanel } from './FinanceBreakdownPanel';

const breakdown: FinanceBreakdown = {
  businessType: 'GUEST_HOUSE',
  revenue: 150000,
  cogs: 40000,
  grossProfit: 110000,
  grossMarginPct: 73.3,
  otherIncome: 5000,
  operatingExpenses: 60000,
  maintenanceCosts: 12000,
  netProfit: 55000,
  netMarginPct: 36.7,
  dailyTrend: [],
  expensesByCategory: [{ category: 'MAINTENANCE', total: 12000, count: 2 }],
  breakdowns: [
    {
      key: 'revenue-source',
      title: 'Revenue by room',
      rows: [
        { key: 'Room 1', label: 'Room 1', amount: 100000, count: 8 },
        { key: 'Room 2', label: 'Room 2', amount: 50000, count: 4 },
      ],
    },
    {
      key: 'expenses-by-category',
      title: 'Expenses by category',
      rows: [{ key: 'MAINTENANCE', label: 'MAINTENANCE', amount: 12000, count: 2 }],
    },
  ],
  leaks: [
    {
      key: 'outstanding-invoices',
      label: 'Uncollected invoices',
      amount: 25000,
      detail: 'Issued or partially paid invoices.',
    },
  ],
};

describe('FinanceBreakdownPanel', () => {
  it('renders the P&L, per-vertical groups and leaks', () => {
    render(<FinanceBreakdownPanel breakdown={breakdown} />);

    expect(screen.getByText('Revenue by room')).toBeInTheDocument();
    expect(screen.getByText('Room 1')).toBeInTheDocument();
    expect(screen.getByText('Room 2')).toBeInTheDocument();
    expect(screen.getByText('Where money is leaking')).toBeInTheDocument();
    expect(screen.getByText('Uncollected invoices')).toBeInTheDocument();
    // Expense categories are shown with their human label, not the raw key.
    expect(screen.getByText('Maintenance & repairs')).toBeInTheDocument();
  });

  it('shows a negative net profit without crashing', () => {
    render(
      <FinanceBreakdownPanel
        breakdown={{ ...breakdown, netProfit: -5000, leaks: [] }}
      />,
    );
    expect(screen.getByText('KES -5,000')).toBeInTheDocument();
  });
});
