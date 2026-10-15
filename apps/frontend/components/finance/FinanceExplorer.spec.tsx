import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/services/business-finance.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/business-finance.service')>();
  return {
    ...actual,
    searchFinances: vi.fn(async () => ({
      businessType: 'GUEST_HOUSE',
      period: 'rolling30' as const,
      totalMatched: 2,
      results: [
        {
          id: 'revenue:revenue-source:Room 1',
          type: 'REVENUE' as const,
          label: 'Room 1',
          subtitle: 'Revenue by room',
          amount: 100000,
          sharePct: 66.7,
          detail: null,
        },
        {
          id: 'leak:wastage',
          type: 'LEAK' as const,
          label: 'Stock written off',
          subtitle: 'Money leak',
          amount: 5000,
          sharePct: null,
          detail: 'Wastage at cost price.',
        },
      ],
    })),
  };
});

import { FinanceExplorer } from './FinanceExplorer';

describe('FinanceExplorer', () => {
  it('renders search results with amounts and shares', async () => {
    render(<FinanceExplorer orgId="org_1" getToken={async () => 'token'} />);

    expect(await screen.findByText('Room 1')).toBeInTheDocument();
    expect(screen.getByText('Stock written off')).toBeInTheDocument();
    expect(screen.getByText('KES 100,000')).toBeInTheDocument();
    expect(screen.getByText('66.7% of total')).toBeInTheDocument();
    expect(screen.getByText('2 matches')).toBeInTheDocument();
  });
});
