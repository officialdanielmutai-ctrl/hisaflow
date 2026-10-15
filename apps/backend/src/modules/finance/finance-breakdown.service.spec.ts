import { PrismaService } from '../../infrastructure/prisma.service';
import { FinanceBreakdownService } from './finance-breakdown.service';

const ORG = 'org_a';
const START = new Date('2026-01-01T00:00:00.000Z');
const END = new Date('2026-01-31T23:59:59.000Z');

function build(businessType: string, overrides: Record<string, any> = {}) {
  const db: any = {
    organization: { findUnique: jest.fn(async () => ({ businessType })) },
    inventoryTransaction: { findMany: jest.fn(async () => []) },
    businessTransaction: { findMany: jest.fn(async () => []) },
    roomIssue: { findMany: jest.fn(async () => []) },
    payment: { findMany: jest.fn(async () => []) },
    feePayment: { findMany: jest.fn(async () => []) },
    invoice: { findMany: jest.fn(async () => []) },
    feeInvoice: { findMany: jest.fn(async () => []) },
    creditRecord: { findMany: jest.fn(async () => []) },
    stockBatch: { findMany: jest.fn(async () => []) },
    ...overrides,
  };
  const service = new FinanceBreakdownService({ db } as unknown as PrismaService);
  return { service, db };
}

describe('FinanceBreakdownService — guest house', () => {
  it('counts invoiced room/service revenue, maintenance costs and leaks', async () => {
    const { service } = build('GUEST_HOUSE', {
      inventoryTransaction: {
        findMany: jest.fn(async () => [
          {
            type: 'WASTAGE',
            quantityChange: -2,
            createdAt: new Date('2026-01-05T10:00:00.000Z'),
            item: { name: 'Soda', costPrice: 10, sellingPrice: 60 },
          },
        ]),
      },
      businessTransaction: {
        findMany: jest.fn(async () => [
          { type: 'EXPENSE', category: 'RENT', amount: 100 },
          { type: 'INCOME', category: 'OTHER', amount: 50 },
        ]),
      },
      roomIssue: {
        findMany: jest.fn(async () => [
          { cost: 300, status: 'OPEN', room: { name: 'Room 1' } },
        ]),
      },
      payment: {
        findMany: jest.fn(async () => [
          {
            amount: 1000,
            recordedAt: new Date('2026-01-10T10:00:00.000Z'),
            invoice: {
              roomTotal: 1000,
              consumptionTotal: 0,
              adjustmentsTotal: 0,
              booking: { room: { name: 'Room 1' } },
            },
          },
          {
            amount: 500,
            recordedAt: new Date('2026-01-11T10:00:00.000Z'),
            invoice: {
              roomTotal: 0,
              consumptionTotal: 500,
              adjustmentsTotal: 0,
              booking: { room: { name: 'Room 2' } },
            },
          },
        ]),
      },
      invoice: {
        findMany: jest.fn(async () => [
          { roomTotal: 1000, consumptionTotal: 0, adjustmentsTotal: 0, amountPaid: 0 },
        ]),
      },
    });

    const result = await service.getBreakdown(ORG, START, END);

    expect(result.businessType).toBe('GUEST_HOUSE');
    expect(result.revenue).toBe(1500);
    expect(result.cogs).toBe(20);
    expect(result.grossProfit).toBe(1480);
    expect(result.otherIncome).toBe(50);
    expect(result.maintenanceCosts).toBe(300);
    expect(result.operatingExpenses).toBe(400);
    expect(result.netProfit).toBe(1130);

    const roomGroup = result.breakdowns.find((group) => group.key === 'revenue-source');
    expect(roomGroup?.title).toBe('Revenue by room');
    expect(roomGroup?.rows.map((row) => row.label).sort()).toEqual(['Room 1', 'Room 2']);

    const mix = result.breakdowns.find((group) => group.key === 'revenue-mix');
    expect(mix?.rows).toContainEqual({ key: 'room', label: 'Room charges', amount: 1000 });
    expect(mix?.rows).toContainEqual({
      key: 'services',
      label: 'Services & extras',
      amount: 500,
    });

    expect(result.leaks.map((leak) => leak.key).sort()).toEqual([
      'maintenance',
      'outstanding-invoices',
      'wastage',
    ]);
    expect(result.expensesByCategory).toContainEqual({
      category: 'MAINTENANCE',
      total: 300,
      count: 1,
    });
  });
});

describe('FinanceBreakdownService — ISP', () => {
  it('breaks invoiced revenue down by subscription plan', async () => {
    const { service } = build('ISP', {
      payment: {
        findMany: jest.fn(async () => [
          {
            amount: 2000,
            recordedAt: new Date('2026-01-12T10:00:00.000Z'),
            invoice: { plan: { name: 'Home 10Mbps' } },
          },
        ]),
      },
    });

    const result = await service.getBreakdown(ORG, START, END);

    expect(result.revenue).toBe(2000);
    expect(result.breakdowns).toContainEqual({
      key: 'revenue-source',
      title: 'Revenue by plan',
      rows: [{ key: 'Home 10Mbps', label: 'Home 10Mbps', amount: 2000, count: 1 }],
    });
  });
});

describe('FinanceBreakdownService — school', () => {
  it('adds fee payments to inventory revenue and groups fees by class', async () => {
    const { service } = build('SCHOOL', {
      inventoryTransaction: {
        findMany: jest.fn(async () => [
          {
            type: 'SALE',
            quantityChange: -1,
            createdAt: new Date('2026-01-06T10:00:00.000Z'),
            item: { name: 'Exercise book', costPrice: 20, sellingPrice: 50 },
          },
        ]),
      },
      feePayment: {
        findMany: jest.fn(async () => [
          {
            amount: 10000,
            recordedAt: new Date('2026-01-07T10:00:00.000Z'),
            invoice: { student: { class: { name: 'Form 1' } } },
          },
        ]),
      },
      feeInvoice: {
        findMany: jest.fn(async () => [
          { totalExpected: 20000, adjustmentsTotal: 0, amountPaid: 10000 },
        ]),
      },
    });

    const result = await service.getBreakdown(ORG, START, END);

    expect(result.revenue).toBe(10050); // 10,000 fees + 50 book sales
    expect(result.cogs).toBe(20);
    expect(result.breakdowns).toContainEqual({
      key: 'revenue-source',
      title: 'Fees collected by class',
      rows: [{ key: 'Form 1', label: 'Form 1', amount: 10000, count: 1 }],
    });
    expect(result.leaks).toContainEqual(
      expect.objectContaining({ key: 'outstanding-fees', amount: 10000 }),
    );
  });
});

describe('FinanceBreakdownService — retail', () => {
  it('reports commodity revenue, wastage and unpaid credit', async () => {
    const { service } = build('DUKA', {
      inventoryTransaction: {
        findMany: jest.fn(async () => [
          {
            type: 'SALE',
            quantityChange: -3,
            createdAt: new Date('2026-01-08T10:00:00.000Z'),
            item: { name: 'Sugar', costPrice: 5, sellingPrice: 10 },
          },
          {
            type: 'WASTAGE',
            quantityChange: -1,
            createdAt: new Date('2026-01-09T10:00:00.000Z'),
            item: { name: 'Sugar', costPrice: 5, sellingPrice: 10 },
          },
        ]),
      },
      creditRecord: {
        findMany: jest.fn(async () => [{ amountTotal: 400, amountPaid: 100 }]),
      },
    });

    const result = await service.getBreakdown(ORG, START, END);

    expect(result.revenue).toBe(30);
    expect(result.cogs).toBe(20);
    expect(result.breakdowns).toContainEqual({
      key: 'revenue-source',
      title: 'Revenue by commodity',
      rows: [{ key: 'Sugar', label: 'Sugar', amount: 30, count: 3 }],
    });
    expect(result.leaks.map((leak) => leak.key).sort()).toEqual(['outstanding-credit', 'wastage']);
    expect(result.leaks.find((leak) => leak.key === 'outstanding-credit')?.amount).toBe(300);
  });
});
