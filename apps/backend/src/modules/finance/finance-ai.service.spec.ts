import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma.service';
import { FinanceAiService } from './finance-ai.service';

jest.mock('openai', () => {
  const create = jest.fn();
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: { completions: { create } },
    })),
    __create: create,
  };
});

const mockCreate = (jest.requireMock('openai') as { __create: jest.Mock }).__create;

const ORG = 'org_a';

function overview() {
  return {
    grossRevenue: 10000,
    grossProfit: 3000,
    grossMarginPct: 30,
    totalOperatingExpenses: 1500,
    netProfit: 1500,
    netMarginPct: 13.04,
    totalInventoryValue: 5000,
    unpricedCount: 2,
    expensesByCategory: [{ category: 'RENT', total: 1500, count: 1 }],
  };
}

function build(opts: { items?: any[]; litellm?: boolean } = {}) {
  const organizationFindUnique = jest.fn(async () => ({ businessType: 'Retail' }));
  const inventoryItemFindMany = jest.fn(async () => opts.items ?? []);
  const config = {
    get: jest.fn((key: string) => {
      if (!opts.litellm) return undefined;
      if (key === 'litellm.baseUrl') return 'http://litellm.local';
      if (key === 'litellm.masterKey') return 'test-key';
      return undefined;
    }),
  };
  const db: any = {
    organization: { findUnique: organizationFindUnique },
    inventoryItem: { findMany: inventoryItemFindMany },
  };
  const service = new FinanceAiService({ db } as unknown as PrismaService, config as any);
  return { service, organizationFindUnique, inventoryItemFindMany };
}

describe('FinanceAiService — forecast', () => {
  beforeEach(() => mockCreate.mockReset());

  it('returns the deterministic fallback when the gateway is not configured', async () => {
    const { service, organizationFindUnique } = build({ litellm: false });

    const result = await service.getForecast(ORG, overview());

    expect(result.insights).toHaveLength(4);
    expect(result.insights.every((i) => i.sentiment === 'NEUTRAL')).toBe(true);
    expect(organizationFindUnique).toHaveBeenCalledWith({
      where: { id: ORG },
      select: { businessType: true },
    });
  });

  it('parses the model JSON when the gateway is configured', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content:
              '[{"title":"Cash is tight","body":"Expenses exceed profit.","sentiment":"NEGATIVE"}]',
          },
        },
      ],
    });
    const { service } = build({ litellm: true });

    const result = await service.getForecast(ORG, overview());

    expect(result.insights).toEqual([
      { title: 'Cash is tight', body: 'Expenses exceed profit.', sentiment: 'NEGATIVE' },
    ]);
  });

  it('falls back when the model returns malformed JSON', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'not json at all' } }],
    });
    const { service } = build({ litellm: true });

    const result = await service.getForecast(ORG, overview());

    expect(result.insights).toHaveLength(4);
  });
});

describe('FinanceAiService — price suggestions', () => {
  beforeEach(() => mockCreate.mockReset());

  const unpriced = [
    { id: 'i1', name: 'Sugar', unit: 'kg', category: 'dry', costPrice: null, sellingPrice: null },
    { id: 'i2', name: 'Milk', unit: 'ltr', category: 'dairy', costPrice: new Prisma.Decimal(50), sellingPrice: null },
  ];

  it('returns an empty list when every item is priced', async () => {
    const { service } = build({ items: [] });

    await expect(service.getPriceSuggestions(ORG)).resolves.toEqual([]);
  });

  it('returns the deterministic LOW-confidence fallback when offline', async () => {
    const { service } = build({ items: unpriced, litellm: false });

    const result = await service.getPriceSuggestions(ORG);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      itemId: 'i1',
      confidence: 'LOW',
      suggestedCostPrice: null,
      suggestedSellingPrice: null,
    });
  });

  it('maps model suggestions back onto items by name', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content:
              '```json\n[{"name":"Sugar","suggestedCostPrice":100,"suggestedSellingPrice":130,"confidence":"HIGH","note":"market"}]```',
          },
        },
      ],
    });
    const { service } = build({ items: unpriced, litellm: true });

    const result = await service.getPriceSuggestions(ORG);
    const sugar = result.find((r) => r.itemId === 'i1');

    expect(sugar).toMatchObject({
      suggestedCostPrice: 100,
      suggestedSellingPrice: 130,
      confidence: 'HIGH',
      note: 'market',
    });
  });

  it('falls back when the model output has an invalid structure', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"not":"an array"}' } }],
    });
    const { service } = build({ items: unpriced, litellm: true });

    const result = await service.getPriceSuggestions(ORG);

    expect(result.every((r) => r.confidence === 'LOW')).toBe(true);
  });
});
