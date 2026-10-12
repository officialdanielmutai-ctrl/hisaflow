import { ForbiddenException } from '@nestjs/common';
import { AssistantShadowService } from './shadow.service';
import type { ToolContext } from '../tool.types';
import type { ParsedAction } from '../../ai-ingestion/ai-ingestion.service';

const CTX = {
  organizationId: 'org_1',
  userId: 'user_1',
  role: 'OWNER',
  businessType: 'DUKA',
  tier: 'SOLO',
  isImpersonated: false,
} as unknown as ToolContext;

function action(
  partial: Partial<ParsedAction> & { type: ParsedAction['type'] },
): ParsedAction {
  return {
    itemId: null,
    itemName: 'Item',
    quantity: 1,
    confidence: 'HIGH',
    ...partial,
  };
}

function build(options: {
  enabled?: boolean;
  legacy?: ParsedAction[];
  toolCalls?: Array<{ id: string; name: string; args: Record<string, unknown> }>;
} = {}) {
  const enabled = options.enabled ?? true;
  const flags = {
    assertEnabled: enabled
      ? jest.fn(async () => undefined)
      : jest.fn(async () => {
          throw new ForbiddenException('assistant.shadow not enabled');
        }),
  };
  const aiIngestion = {
    parseInventoryText: jest.fn(async () => options.legacy ?? []),
  };
  const agent = {
    run: jest.fn(async () => ({
      reply: 'ok',
      toolCalls: options.toolCalls ?? [],
      proposals: [],
      capped: false,
    })),
  };
  const audit = { record: jest.fn(async () => undefined) };
  const service = new AssistantShadowService(
    flags as never,
    aiIngestion as never,
    agent as never,
    audit as never,
  );
  return { service, flags, aiIngestion, agent, audit };
}

describe('AssistantShadowService', () => {
  it('refuses to run when the shadow flag is off', async () => {
    const { service, aiIngestion } = build({ enabled: false });

    await expect(service.run(CTX, 'sold 3 unga')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(aiIngestion.parseInventoryText).not.toHaveBeenCalled();
  });

  it('compares the legacy and new pipelines and audits the score', async () => {
    const { service, aiIngestion, agent, audit } = build({
      legacy: [action({ type: 'SALE', itemId: 'i1', quantity: 3 })],
      toolCalls: [
        { id: 'c1', name: 'record_sale', args: { itemId: 'i1', quantity: 3 } },
        { id: 'c2', name: 'get_low_stock', args: {} },
      ],
    });

    const report = await service.run(CTX, 'sold 3 unga');

    expect(aiIngestion.parseInventoryText).toHaveBeenCalledWith(
      'sold 3 unga',
      'org_1',
    );
    expect(agent.run).toHaveBeenCalledWith('org_1', 'user_1', false, 'sold 3 unga');
    // Read tools are not comparable and are ignored.
    expect(report.legacyCount).toBe(1);
    expect(report.nextCount).toBe(1);
    expect(report.exact).toBe(1);
    expect(report.score).toBe(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'shadow_compare' }),
    );
  });
});
