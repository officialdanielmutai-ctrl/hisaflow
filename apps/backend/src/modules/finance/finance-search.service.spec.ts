import { PrismaService } from '../../infrastructure/prisma.service';
import { FinanceBreakdownService } from './finance-breakdown.service';
import { FinanceSearchService } from './finance-search.service';

const ORG = 'org_a';

function build(
  breakdown: Record<string, unknown>,
  overrides: { credits?: any[]; ledger?: any[] } = {},
) {
  const db: any = {
    creditRecord: { findMany: jest.fn(async () => overrides.credits ?? []) },
    businessTransaction: { findMany: jest.fn(async () => overrides.ledger ?? []) },
  };
  const breakdownService = {
    getBreakdown: jest.fn(async () => breakdown),
  } as unknown as FinanceBreakdownService;
  const service = new FinanceSearchService(
    { db } as unknown as PrismaService,
    breakdownService,
  );
  return { service, db, breakdownService };
}

const SNAPSHOT = {
  businessType: 'GUEST_HOUSE',
  revenue: 150000,
  cogs: 0,
  grossProfit: 150000,
  grossMarginPct: 100,
  otherIncome: 0,
  operatingExpenses: 60000,
  maintenanceCosts: 12000,
  netProfit: 90000,
  netMarginPct: 60,
  dailyTrend: [],
  expensesByCategory: [],
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
      key: 'maintenance-by-room',
      title: 'Maintenance by room',
      rows: [{ key: 'Room 1', label: 'Room 1', amount: 12000, count: 2 }],
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

describe('FinanceSearchService', () => {
  it('matches revenue attributes and computes their share of revenue', async () => {
    const { service } = build(SNAPSHOT);

    const result = await service.search(ORG, 'room 1');

    const revenue = result.results.find((r) => r.type === 'REVENUE' && r.label === 'Room 1');
    expect(revenue?.amount).toBe(100000);
    expect(revenue?.sharePct).toBe(66.7);
    expect(result.totalMatched).toBeGreaterThanOrEqual(2);
  });

  it('includes unpaid credits and ledger entries in the search index', async () => {
    const { service } = build(SNAPSHOT, {
      credits: [{ id: 'c1', clientName: 'Ali Traders', amountTotal: 400, amountPaid: 100 }],
      ledger: [
        {
          id: 't1',
          type: 'EXPENSE',
          category: 'RENT',
          amount: 1500,
          description: 'October rent',
          staffName: null,
          date: new Date('2026-01-10T00:00:00.000Z'),
        },
      ],
    });

    const credit = await service.search(ORG, 'ali');
    expect(credit.results[0]).toMatchObject({ type: 'CREDIT', label: 'Ali Traders', amount: 300 });

    const rent = await service.search(ORG, 'october');
    expect(rent.results[0]).toMatchObject({ type: 'LEDGER', label: 'RENT', amount: 1500 });
  });

  it('returns the largest attributes when the query is empty', async () => {
    const { service } = build(SNAPSHOT);

    const result = await service.search(ORG, '');

    expect(result.period).toBe('rolling30');
    expect(result.results[0].amount).toBe(100000);
    expect(result.totalMatched).toBeGreaterThan(0);
  });
});
