import { BadRequestException } from '@nestjs/common';
import { ProposalService } from './proposal/proposal.service';
import { AssistantService } from './assistant.service';
import { EntityResolutionService } from './resolution/entity-resolution.service';
import { AssistantToolsService } from './tools/assistant-tools.service';
import { AppRole } from '../../core/decorators/roles.decorator';
import type { ToolContext, ToolDefinition } from './tool.types';
import type { PrismaService } from '../../infrastructure/prisma.service';

describe('Assistant Upgrade: Symptoms S1-S4 Verification & Golden Tests', () => {
  const CTX: ToolContext = {
    organizationId: 'org_test',
    userId: 'user_test',
    role: AppRole.OWNER,
    businessType: 'DUKA',
    tier: 'GROWTH',
    isImpersonated: false,
    conversationId: 'conv_123',
  };

  describe('S2: Product Phrasing & Entity Resolution (10 Phrasings Test)', () => {
    let resolution: EntityResolutionService;
    let mockPrisma: {
      db: {
        inventoryItem: {
          findMany: jest.Mock;
        };
      };
    };

    const mockCatalog = [
      {
        id: 'sugar_id_1kg',
        name: 'Default',
        unit: 'kg',
        quantity: 100,
        sellingPrice: 160,
        costPrice: 120,
        product: { name: 'White Sugar 1kg' },
      },
      {
        id: 'unga_id_2kg',
        name: 'Default',
        unit: 'packet',
        quantity: 50,
        sellingPrice: 190,
        costPrice: 150,
        product: { name: 'Maize Flour 2kg' },
      },
      {
        id: 'milk_id_500ml',
        name: 'Fresh',
        unit: 'packet',
        quantity: 40,
        sellingPrice: 65,
        costPrice: 50,
        product: { name: 'Brookside Milk 500ml' },
      },
    ];

    beforeEach(() => {
      mockPrisma = {
        db: {
          inventoryItem: {
            findMany: jest.fn().mockResolvedValue(mockCatalog),
          },
        },
      };
      resolution = new EntityResolutionService(
        mockPrisma as unknown as PrismaService,
      );
    });

    const PHRASINGS = [
      { query: 'White Sugar 1kg', label: '1. Exact product name' },
      { query: 'sugar', label: '2. Shorthand product name' },
      { query: 'sugars', label: '3. Plural form' },
      { query: 'sukari', label: '4. Swahili name' },
      { query: 'shukari', label: '5. Swahili phonetic variant' },
      { query: 'shuger', label: '6. Typo spelling' },
      { query: 'Sugar - 1kg', label: '7. Name with punctuation' },
      { query: '2 bags of sugar', label: '8. Product with unit phrase' },
      { query: 'white sugar', label: '9. Substring without unit' },
      { query: 'sugar 1 kg', label: '10. Spaced unit variation' },
    ];

    for (const { query, label } of PHRASINGS) {
      it(`resolves phrasing [${label}]: "${query}" to White Sugar 1kg`, async () => {
        const res = await resolution.resolveInventoryItem(CTX.organizationId, query);
        expect(res.bestMatch).not.toBeNull();
        expect(res.bestMatch?.id).toBe('sugar_id_1kg');
      });
    }

    it('resolves Swahili staple "unga" to Maize Flour', async () => {
      const res = await resolution.resolveInventoryItem(CTX.organizationId, 'unga');
      expect(res.bestMatch).not.toBeNull();
      expect(res.bestMatch?.id).toBe('unga_id_2kg');
    });

    it('resolves Swahili term "maziwa" to Milk', async () => {
      const res = await resolution.resolveInventoryItem(CTX.organizationId, 'maziwa');
      expect(res.bestMatch).not.toBeNull();
      expect(res.bestMatch?.id).toBe('milk_id_500ml');
    });
  });

  describe('S4: Supersede Logic (Prevent Previous Sale Re-submission)', () => {
    let proposals: ProposalService;
    let mockPrisma: {
      db: {
        assistantProposal: {
          create: jest.Mock;
          updateMany: jest.Mock;
          findFirst: jest.Mock;
        };
      };
    };
    let storedProposals: Array<{
      id: string;
      organizationId: string;
      tool: string;
      status: string;
      conversationId?: string | null;
      expiresAt: Date;
    }>;

    beforeEach(() => {
      storedProposals = [];
      mockPrisma = {
        db: {
          assistantProposal: {
            create: jest.fn(async ({ data }) => {
              const record = {
                id: `prop_${storedProposals.length + 1}`,
                status: 'PROPOSED',
                ...data,
              };
              storedProposals.push(record);
              return record;
            }),
            updateMany: jest.fn(async ({ where, data }) => {
              let count = 0;
              for (const p of storedProposals) {
                if (
                  p.organizationId === where.organizationId &&
                  p.tool === where.tool &&
                  p.status === where.status &&
                  (!where.conversationId || p.conversationId === where.conversationId)
                ) {
                  p.status = data.status;
                  count++;
                }
              }
              return { count };
            }),
            findFirst: jest.fn(async ({ where }) => {
              return storedProposals.find((p) => p.id === where.id) ?? null;
            }),
          },
        },
      };
      proposals = new ProposalService(mockPrisma as unknown as PrismaService);
    });

    it('supersedes earlier PROPOSED proposal of same tool in the same conversation', async () => {
      const tool = {
        name: 'record_sale',
        riskLevel: 'medium',
      } as unknown as ToolDefinition;

      // First sale proposal
      const p1 = await proposals.create(
        CTX,
        tool,
        { args: { itemId: 'item_1', quantity: 2 }, summary: 'Sell 2 item 1' },
        { conversationId: CTX.conversationId },
      );
      expect(p1.status).toBe('PROPOSED');

      // Second sale proposal in the same conversation
      const p2 = await proposals.create(
        CTX,
        tool,
        { args: { itemId: 'item_2', quantity: 5 }, summary: 'Sell 5 item 2' },
        { conversationId: CTX.conversationId },
      );

      // Verify the first proposal was marked SUPERSEDED
      const firstInStore = storedProposals.find((p) => p.id === p1.id);
      expect(firstInStore?.status).toBe('SUPERSEDED');

      // Refuses approving the superseded proposal
      await expect(
        proposals.approve(CTX.organizationId, p1.id, CTX.userId),
      ).rejects.toBeInstanceOf(BadRequestException);

      // Verify the second proposal is currently PROPOSED
      const secondInStore = storedProposals.find((p) => p.id === p2.id);
      expect(secondInStore?.status).toBe('PROPOSED');
    });
  });

  describe('S3: Atomic Approval & Execution (One-Tap Flow)', () => {
    let assistant: AssistantService;
    let mockContext: { build: jest.Mock };
    let mockProposals: { approve: jest.Mock; getScoped: jest.Mock };
    let mockExecutor: { execute: jest.Mock };

    beforeEach(() => {
      mockContext = {
        build: jest.fn().mockResolvedValue(CTX),
      };
      mockProposals = {
        approve: jest.fn().mockResolvedValue({
          id: 'prop_1',
          organizationId: CTX.organizationId,
          tool: 'record_sale',
          status: 'APPROVED',
          argsJson: '{"itemId":"item_1","quantity":1}',
          argsHash: 'hash1',
          summary: 'Sell 1 Sugar',
          version: 1,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 60000),
          decidedAt: new Date(),
          decidedBy: CTX.userId,
          executedAt: null,
          resultJson: null,
          errorMessage: null,
        }),
        getScoped: jest.fn().mockResolvedValue({
          id: 'prop_1',
          organizationId: CTX.organizationId,
          tool: 'record_sale',
          status: 'EXECUTED',
          argsJson: '{"itemId":"item_1","quantity":1}',
          argsHash: 'hash1',
          summary: 'Sell 1 Sugar',
          version: 1,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 60000),
          decidedAt: new Date(),
          decidedBy: CTX.userId,
          executedAt: new Date(),
          resultJson: '{"transactionId":"tx_123"}',
          errorMessage: null,
        }),
      };
      mockExecutor = {
        execute: jest.fn().mockResolvedValue({
          proposalId: 'prop_1',
          status: 'EXECUTED',
          result: { transactionId: 'tx_123' },
          idempotent: false,
        }),
      };

      assistant = new AssistantService(
        mockContext as never,
        {} as never,
        {} as never,
        mockProposals as never,
        mockExecutor as never,
        {} as never,
        {} as never,
        {} as never,
      );
    });

    it('approves AND executes atomically on a single approve call', async () => {
      const result = await assistant.approve(CTX.organizationId, 'prop_1', CTX.userId);

      // Verify proposal was marked approved
      expect(mockProposals.approve).toHaveBeenCalledWith(CTX.organizationId, 'prop_1', CTX.userId);
      // Verify executor was called automatically
      expect(mockExecutor.execute).toHaveBeenCalledWith(CTX.organizationId, CTX, 'prop_1');
      // Verify returned status is EXECUTED
      expect(result.status).toBe('EXECUTED');
      expect(result.execution?.result).toEqual({ transactionId: 'tx_123' });
    });
  });

  describe('S1: Single-Round-Trip Direct Sale Proposal', () => {
    let tools: AssistantToolsService;
    let mockPrisma: {
      db: {
        inventoryItem: {
          findFirst: jest.Mock;
        };
      };
    };
    let mockResolution: { resolveInventoryItem: jest.Mock };

    beforeEach(() => {
      mockPrisma = {
        db: {
          inventoryItem: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'item_sugar',
              name: 'White Sugar',
              unit: 'kg',
              quantity: 50,
              isComposite: false,
              product: { name: 'White Sugar 1kg' },
            }),
          },
        },
      };
      mockResolution = {
        resolveInventoryItem: jest.fn().mockResolvedValue({
          bestMatch: {
            id: 'item_sugar',
            name: 'White Sugar 1kg',
            unit: 'kg',
            quantity: 50,
            score: 0.95,
          },
          candidates: [],
          confidence: 'high',
        }),
      };

      tools = new AssistantToolsService(
        mockPrisma as unknown as PrismaService,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        mockResolution as unknown as EntityResolutionService,
      );
    });

    it('allows record_sale with itemName directly without prior search_inventory roundtrip', async () => {
      const saleTool = tools.all().find((t) => t.name === 'record_sale');
      expect(saleTool).toBeDefined();

      const draft = await saleTool!.buildProposal!({ itemName: 'sugar', quantity: 2 }, CTX);

      expect(draft.args.itemId).toBe('item_sugar');
      expect(draft.args.quantity).toBe(2);
      expect(draft.summary).toContain('White Sugar');
      // Resolution service was invoked directly inside record_sale
      expect(mockResolution.resolveInventoryItem).toHaveBeenCalledWith(CTX.organizationId, 'sugar');
    });
  });
});
