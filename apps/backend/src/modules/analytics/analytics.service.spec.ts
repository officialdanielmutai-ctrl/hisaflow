import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma.service';
import { AnalyticsService } from './analytics.service';
import { VerticalAnalyticsService } from './vertical-analytics.service';

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import OpenAI from 'openai';

const MockedOpenAI = OpenAI as unknown as jest.Mock;
const ORG = 'org_a';
const OTHER_ORG = 'org_b';

function build(opts: { todayTx?: any[]; yesterdayTx?: any[]; items?: any[]; alerts?: any[]; topSellers?: any[]; businessType?: string; baseUrl?: string; apiKey?: string } = {}) {
  const items = opts.items ?? [];
  const inventoryItem = {
    findMany: jest.fn(async (args: any) =>
      args?.where?.organizationId === OTHER_ORG ? [] : items,
    ),
    findUnique: jest.fn(async ({ where }: any) => items.find((i: any) => i.id === where.id) ?? null),
  };
  const inventoryTransaction = {
    findMany: jest.fn(async (args: any) => (args?.where?.createdAt?.lt ? opts.yesterdayTx ?? [] : opts.todayTx ?? [])),
    groupBy: jest.fn(async () => opts.topSellers ?? []),
  };
  const alert = { findMany: jest.fn(async () => opts.alerts ?? []) };
  const checklistItem = { count: jest.fn(async () => 0) };
  const organization = {
    findUnique: jest.fn(async () => ({ businessType: opts.businessType ?? 'DUKA' })),
  };
  const db: any = { inventoryItem, inventoryTransaction, alert, checklistItem, organization };

  const configService = {
    get: jest.fn((key: string) => (key === 'litellm.baseUrl' ? opts.baseUrl : key === 'litellm.masterKey' ? opts.apiKey : undefined)),
  };
  const verticalAnalytics = {
    getGuestHouseDashboard: jest.fn(async () => ({ kind: 'guesthouse' })),
    getSchoolDashboard: jest.fn(async () => ({ kind: 'school' })),
    getChemistDashboard: jest.fn(async () => ({ kind: 'chemist' })),
    getRestaurantDashboard: jest.fn(async () => ({ kind: 'restaurant' })),
    getWholesaleDashboard: jest.fn(async () => ({ kind: 'wholesale' })),
  };

  const service = new AnalyticsService(
    { db } as unknown as PrismaService,
    configService as unknown as ConfigService,
    verticalAnalytics as unknown as VerticalAnalyticsService,
  );
  return { service, inventoryItem, inventoryTransaction, alert, checklistItem, organization, configService, verticalAnalytics, db };
}

describe('AnalyticsService', () => {
  beforeEach(() => {
    MockedOpenAI.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('getDashboardSummary', () => {
    const items = [
      { id: 'a', name: 'Sugar', quantity: 10, reorderThreshold: 5, category: 'dry', unit: 'kg' },
      { id: 'b', name: 'Milk', quantity: 3, reorderThreshold: 5, category: 'dairy', unit: 'litres' },
      { id: 'c', name: 'Bread', quantity: 0, reorderThreshold: 5, category: 'bakery', unit: 'loaves' },
    ];

    it('computes sales, expenses, profit and inventory health for the org', async () => {
      const { service } = build({
        items,
        todayTx: [
          { type: 'SALE', quantityChange: -3, item: { sellingPrice: 100, costPrice: 60 } },
          { type: 'PURCHASE', quantityChange: 2, item: { sellingPrice: 100, costPrice: 50 } },
        ],
        alerts: [{ id: 'al_1', title: 'Milk low', severity: 'WARNING', type: 'LOW_STOCK' }],
      });

      const result = await service.getDashboardSummary(ORG);

      expect(result.kpis).toEqual({
        todaySales: 300,
        todayExpenses: 100,
        lowStockCount: 2,
        profitEstimate: 200,
      });
      expect(result.inventorySnapshot).toEqual({
        total: 3,
        healthy: 1,
        low: 1,
        outOfStock: 1,
        stockHealthPct: 33,
      });
      expect(result.attentionFeed).toEqual([
        { id: 'al_1', message: 'Milk low', severity: 'WARNING', type: 'LOW_STOCK' },
      ]);
      expect(['morning', 'afternoon', 'evening']).toContain(result.greeting.timeOfDay);
      expect(result.recommendedActions).toHaveLength(3);
    });

    it('scopes every read to the calling organisation', async () => {
      const { service, inventoryItem, inventoryTransaction, alert } = build({ items });

      await service.getDashboardSummary(ORG);

      for (const call of inventoryItem.findMany.mock.calls) {
        expect(call[0].where).toEqual(expect.objectContaining({ organizationId: ORG }));
      }
      expect(inventoryTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organizationId: ORG }) }),
      );
      expect(alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organizationId: ORG }) }),
      );
    });

    it('parses exactly three recommended actions from the AI gateway', async () => {
      const actions = [
        { action: 'Restock milk', reason: 'Low stock', priority: 'HIGH' },
        { action: 'Promote bread', reason: 'Slow moving', priority: 'MEDIUM' },
        { action: 'Review prices', reason: 'Margin drift', priority: 'LOW' },
      ];
      const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify(actions) } }] });
      MockedOpenAI.mockImplementation(() => ({ chat: { completions: { create } } }));

      const { service } = build({ items, baseUrl: 'http://llm.local/v1', apiKey: 'k' });

      const result = await service.getDashboardSummary(ORG);

      expect(result.recommendedActions).toEqual(actions);
      expect(create).toHaveBeenCalledTimes(1);
    });

    it('falls back to static advice when the AI response is malformed', async () => {
      const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: 'not json' } }] });
      MockedOpenAI.mockImplementation(() => ({ chat: { completions: { create } } }));

      const { service } = build({ items, baseUrl: 'http://llm.local/v1', apiKey: 'k' });

      const result = await service.getDashboardSummary(ORG);

      expect(result.recommendedActions).toHaveLength(3);
      expect(result.recommendedActions[0]).toEqual(
        expect.objectContaining({ priority: 'HIGH' }),
      );
    });
  });

  describe('getStaffDashboardSummary', () => {
    it('computes the vs-yesterday trend, tasks and low-stock watch list', async () => {
      const items = [
        { id: 'a', name: 'Sugar', quantity: 2, reorderThreshold: 5, category: 'dry', unit: 'kg' },
        { id: 'b', name: 'Milk', quantity: 1, reorderThreshold: 5, category: 'dairy', unit: 'litres' },
        { id: 'c', name: 'Tea', quantity: 50, reorderThreshold: 5, category: 'dry', unit: 'kg' },
      ];
      const { service, checklistItem } = build({
        items,
        todayTx: [{ type: 'SALE', quantityChange: -5, item: { sellingPrice: 10 } }],
        yesterdayTx: [{ type: 'SALE', quantityChange: -2 }],
      });
      checklistItem.count
        .mockResolvedValueOnce(4) // completed today
        .mockResolvedValueOnce(2); // pending

      const result = await service.getStaffDashboardSummary(ORG);

      expect(result.kpis.todaySalesCount).toBe(5);
      expect(result.kpis.todaySalesTrend).toBe(150);
      expect(result.kpis.todaySalesTrendLabel).toBe('+150% vs yesterday');
      expect(result.kpis.tasksDoneToday).toBe(4);
      expect(result.kpis.tasksLabel).toBe('2 tasks pending');
      expect(result.kpis.totalInventory).toBe(3);
      expect(result.lowStockWatchList.map((i: any) => i.id)).toEqual(['b', 'a']);
    });

    it('reports all-clear when nothing is pending', async () => {
      const { service, checklistItem } = build({ items: [] });
      checklistItem.count.mockResolvedValue(0);

      const result = await service.getStaffDashboardSummary(ORG);

      expect(result.kpis.tasksLabel).toBe('All caught up!');
      expect(result.kpis.totalInventoryLabel).toBe('Across 0 categories');
    });
  });

  describe('vertical delegation', () => {
    it('delegates each vertical dashboard to VerticalAnalyticsService with the org id', async () => {
      const { service, verticalAnalytics } = build();

      await service.getGuestHouseDashboard(ORG);
      await service.getSchoolDashboard(ORG);
      await service.getChemistDashboard(ORG);
      await service.getRestaurantDashboard(ORG);
      await service.getWholesaleDashboard(ORG);

      expect(verticalAnalytics.getGuestHouseDashboard).toHaveBeenCalledWith(ORG);
      expect(verticalAnalytics.getSchoolDashboard).toHaveBeenCalledWith(ORG);
      expect(verticalAnalytics.getChemistDashboard).toHaveBeenCalledWith(ORG);
      expect(verticalAnalytics.getRestaurantDashboard).toHaveBeenCalledWith(ORG);
      expect(verticalAnalytics.getWholesaleDashboard).toHaveBeenCalledWith(ORG);
    });
  });
});
