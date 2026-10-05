import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma.service';
import { AiIngestionService } from './ai-ingestion.service';

// The service constructs `new OpenAI(...)` and calls the chat completions API.
// The whole module is mocked so unit tests never touch a real LLM gateway.
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import OpenAI from 'openai';

const MockedOpenAI = OpenAI as unknown as jest.Mock;

const ORG = 'org_a';
const OTHER_ORG = 'org_b';

function build(
  opts: {
    baseUrl?: string;
    apiKey?: string;
    items?: any[];
    businessType?: string;
    aiContent?: string;
    aiReject?: Error;
  } = {},
) {
  const inventoryItem = { findMany: jest.fn(async () => opts.items ?? []) };
  const organization = {
    findUnique: jest.fn(async () => ({ businessType: opts.businessType ?? 'DUKA' })),
  };
  const db: any = { inventoryItem, organization };

  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'litellm.baseUrl') return opts.baseUrl;
      if (key === 'litellm.masterKey') return opts.apiKey;
      return undefined;
    }),
  };

  const create = opts.aiReject
    ? jest.fn().mockRejectedValue(opts.aiReject)
    : jest.fn().mockResolvedValue({ choices: [{ message: { content: opts.aiContent } }] });

  MockedOpenAI.mockImplementation(() => ({
    chat: { completions: { create } },
  }));

  const service = new AiIngestionService(
    configService as unknown as ConfigService,
    { db } as unknown as PrismaService,
  );

  return { service, inventoryItem, organization, create };
}

const CONFIGURED = { baseUrl: 'http://litellm.local/v1', apiKey: 'test-key' };

describe('AiIngestionService', () => {
  beforeEach(() => {
    MockedOpenAI.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('parseInventoryText — configuration boundary', () => {
    it('returns early without touching the DB or the LLM when unconfigured', async () => {
      const { service, inventoryItem, organization } = build({ items: [] });

      await expect(service.parseInventoryText('sold 2 sugar', ORG)).resolves.toEqual([]);

      expect(MockedOpenAI).not.toHaveBeenCalled();
      expect(inventoryItem.findMany).not.toHaveBeenCalled();
      expect(organization.findUnique).not.toHaveBeenCalled();
    });

    it('scopes both inventory and organisation lookups to the calling org', async () => {
      const { service, inventoryItem, organization } = build({
        ...CONFIGURED,
        items: [{ id: 'item_1', name: 'Sugar', unit: 'kg', packaging: [] }],
        aiContent: '[]',
      });

      await service.parseInventoryText('sold 2 sugar', ORG);

      expect(inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: ORG, isActive: true } }),
      );
      expect(organization.findUnique).toHaveBeenCalledWith({
        where: { id: ORG },
        select: { businessType: true },
      });
    });
  });

  describe('parseInventoryText — response handling', () => {
    it('parses a clean JSON array into actions', async () => {
      const { service } = build({
        ...CONFIGURED,
        aiContent: JSON.stringify([
          { itemId: null, itemName: 'Milk', type: 'SALE', quantity: 2, confidence: 'HIGH' },
        ]),
      });

      const actions = await service.parseInventoryText('sold 2 milk', ORG);

      expect(actions).toHaveLength(1);
      expect(actions[0]).toMatchObject({ itemName: 'Milk', type: 'SALE', quantity: 2 });
    });

    it('strips ```json markdown fences before parsing', async () => {
      const { service } = build({
        ...CONFIGURED,
        aiContent:
          '```json\n[{"itemId":null,"itemName":"Note","type":"NOTE","quantity":0,"confidence":"HIGH","title":"t","content":"c"}]\n```',
      });

      const actions = await service.parseInventoryText('note this', ORG);

      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('NOTE');
    });

    it('returns an empty array when the gateway returns unparseable text', async () => {
      const { service } = build({ ...CONFIGURED, aiContent: 'this is not json' });

      await expect(service.parseInventoryText('anything', ORG)).resolves.toEqual([]);
    });

    it('returns an empty array when the gateway request throws', async () => {
      const { service } = build({ ...CONFIGURED, aiReject: new Error('gateway down') });

      await expect(service.parseInventoryText('anything', ORG)).resolves.toEqual([]);
    });

    it('returns an empty array when the gateway responds with no content', async () => {
      const { service } = build({ ...CONFIGURED, aiContent: undefined });

      await expect(service.parseInventoryText('anything', ORG)).resolves.toEqual([]);
    });
  });

  describe('parseInventoryText — reconciliation layer', () => {
    it('injects the matched itemId when the model omits it', async () => {
      const { service } = build({
        ...CONFIGURED,
        items: [{ id: 'item_1', name: 'Sugar', unit: 'kg', packaging: [] }],
        aiContent: JSON.stringify([
          { itemId: null, itemName: 'Sugar', type: 'SALE', quantity: 2, confidence: 'HIGH' },
        ]),
      });

      const actions = await service.parseInventoryText('sold 2 sugar', ORG);

      expect(actions).toHaveLength(1);
      expect(actions[0].itemId).toBe('item_1');
      expect(actions[0].itemName).toBe('Sugar');
    });

    it('drops a CREATE when the item already exists in the org inventory', async () => {
      const { service } = build({
        ...CONFIGURED,
        items: [{ id: 'item_1', name: 'Sugar', unit: 'kg', packaging: [] }],
        aiContent: JSON.stringify([
          { itemId: null, itemName: 'Sugar', type: 'CREATE', quantity: 1, confidence: 'HIGH' },
        ]),
      });

      await expect(service.parseInventoryText('add sugar', ORG)).resolves.toEqual([]);
    });

    it('keeps a CREATE for a genuinely new item', async () => {
      const { service } = build({
        ...CONFIGURED,
        items: [{ id: 'item_1', name: 'Sugar', unit: 'kg', packaging: [] }],
        aiContent: JSON.stringify([
          { itemId: null, itemName: 'Cooking Oil', type: 'CREATE', quantity: 5, confidence: 'HIGH', unit: 'litres' },
        ]),
      });

      const actions = await service.parseInventoryText('new cooking oil', ORG);

      expect(actions).toHaveLength(1);
      expect(actions[0]).toMatchObject({ type: 'CREATE', itemName: 'Cooking Oil' });
    });

    it('passes non-inventory actions through untouched', async () => {
      const { service } = build({
        ...CONFIGURED,
        items: [],
        aiContent: JSON.stringify([
          { itemId: null, itemName: 'Booking', type: 'BOOKING', quantity: 1, confidence: 'HIGH', guestName: 'Jane' },
          { itemId: null, itemName: 'Note', type: 'NOTE', quantity: 0, confidence: 'HIGH', title: 'Reminder' },
        ]),
      });

      const actions = await service.parseInventoryText('jane booked a room, remind me', ORG);

      expect(actions).toHaveLength(2);
      expect(actions.map((a) => a.type)).toEqual(['BOOKING', 'NOTE']);
    });
  });

  describe('inventory cache', () => {
    it('reuses the 90-second cache and invalidateCache forces a re-fetch', async () => {
      const { service, inventoryItem } = build({
        ...CONFIGURED,
        items: [{ id: 'item_1', name: 'Sugar', unit: 'kg', packaging: [] }],
        aiContent: '[]',
      });

      await service.parseInventoryText('first', ORG);
      await service.parseInventoryText('second', ORG);
      expect(inventoryItem.findMany).toHaveBeenCalledTimes(1);

      service.invalidateCache(ORG);
      await service.parseInventoryText('third', ORG);
      expect(inventoryItem.findMany).toHaveBeenCalledTimes(2);
    });

    it('caches per organisation so one org cannot warm another org cache', async () => {
      const { service, inventoryItem } = build({
        ...CONFIGURED,
        items: [{ id: 'item_1', name: 'Sugar', unit: 'kg', packaging: [] }],
        aiContent: '[]',
      });

      await service.parseInventoryText('a', ORG);
      await service.parseInventoryText('b', OTHER_ORG);

      expect(inventoryItem.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ where: { organizationId: ORG, isActive: true } }),
      );
      expect(inventoryItem.findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ where: { organizationId: OTHER_ORG, isActive: true } }),
      );
    });
  });
});
