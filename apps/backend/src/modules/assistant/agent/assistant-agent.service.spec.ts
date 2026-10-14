import {
  AssistantAgentService,
  MAX_TOOL_CALLS_PER_TURN,
} from './assistant-agent.service';
import type { AgentCompletion } from './agent.types';
import type { ToolContext, ToolDefinition } from '../tool.types';

const CTX = {
  organizationId: 'org_1',
  userId: 'user_1',
  role: 'OWNER',
  businessType: 'DUKA',
  tier: 'SOLO',
  isImpersonated: false,
} as unknown as ToolContext;

function readTool(
  name: string,
  execute: jest.Mock,
): ToolDefinition {
  return {
    name,
    description: `${name} desc`,
    kind: 'read',
    riskLevel: 'low',
    parameters: { type: 'object' },
    execute: execute as unknown as ToolDefinition['execute'],
  };
}

function writeTool(
  name: string,
  buildProposal: jest.Mock,
): ToolDefinition {
  return {
    name,
    description: `${name} desc`,
    kind: 'write',
    riskLevel: 'low',
    parameters: { type: 'object' },
    buildProposal: buildProposal as unknown as ToolDefinition['buildProposal'],
    commit: jest.fn(),
  };
}

function build(options: {
  tools: ToolDefinition[];
  completions: AgentCompletion[];
}) {
  const context = { build: jest.fn(async () => CTX) };
  const registry = {
    listFor: jest.fn(() => options.tools),
    toSchemas: jest.fn((list: ToolDefinition[]) =>
      list.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
    ),
  };
  const policy = { filterTools: jest.fn(async (list: ToolDefinition[]) => list) };
  const proposals = {
    create: jest.fn(
      async (
        _ctx: ToolContext,
        tool: ToolDefinition,
        draft: { args: Record<string, unknown>; summary: string },
      ) => ({
        id: 'prop_1',
        tool: tool.name,
        argsJson: JSON.stringify(draft.args),
        argsHash: 'hash',
        summary: draft.summary,
        diffJson: null,
        riskLevel: 'low',
        status: 'PROPOSED',
        version: 1,
        createdAt: new Date(),
        expiresAt: new Date(),
        decidedAt: null,
      }),
    ),
  };
  let index = 0;
  const provider = {
    complete: jest.fn(
      async () =>
        options.completions[index++] ?? { content: null, toolCalls: [] },
    ),
  };
  const service = new AssistantAgentService(
    context as never,
    registry as never,
    policy as never,
    proposals as never,
    provider as never,
  );
  return { service, policy, proposals, provider };
}

describe('AssistantAgentService', () => {
  it('auto-runs read tools and returns the model reply', async () => {
    const execute = jest.fn(async () => [{ id: 'i1' }]);
    const { service, proposals } = build({
      tools: [readTool('get_low_stock', execute)],
      completions: [
        {
          content: null,
          toolCalls: [{ id: 'c1', name: 'get_low_stock', args: { limit: 5 } }],
        },
        { content: 'You have 1 low item.', toolCalls: [] },
      ],
    });

    const result = await service.run('org_1', 'user_1', false, 'low stock?');

    expect(execute).toHaveBeenCalledWith({ limit: 5 }, CTX);
    expect(result.reply).toBe('You have 1 low item.');
    expect(result.toolCalls).toHaveLength(1);
    expect(proposals.create).not.toHaveBeenCalled();
  });

  it('creates a proposal for a write tool and never commits', async () => {
    const buildProposal = jest.fn(() => ({
      args: { itemId: 'i1', quantity: 3 },
      summary: 'Sell 3 of Ugali',
    }));
    const tool = writeTool('record_sale', buildProposal);
    const { service, proposals } = build({
      tools: [tool],
      completions: [
        {
          content: null,
          toolCalls: [
            { id: 'c1', name: 'record_sale', args: { itemId: 'i1', quantity: 3 } },
          ],
        },
        { content: 'Ready for your review.', toolCalls: [] },
      ],
    });

    const result = await service.run('org_1', 'user_1', false, 'sold 3 ugali');

    expect(proposals.create).toHaveBeenCalledTimes(1);
    expect(result.proposals).toHaveLength(1);
    expect(result.reply).toBe('Ready for your review.');
    expect(tool.commit).not.toHaveBeenCalled();
  });

  it('feeds an unknown tool back to the model instead of failing', async () => {
    const { service, proposals } = build({
      tools: [],
      completions: [
        { content: null, toolCalls: [{ id: 'c1', name: 'nope', args: {} }] },
        { content: 'I cannot do that.', toolCalls: [] },
      ],
    });

    const result = await service.run('org_1', 'user_1', false, 'do x');

    expect(result.toolCalls).toHaveLength(1);
    expect(proposals.create).not.toHaveBeenCalled();
    expect(result.reply).toBe('I cannot do that.');
  });

  it('caps tool calls per turn', async () => {
    const execute = jest.fn(async () => []);
    const toolCall: AgentCompletion = {
      content: null,
      toolCalls: [{ id: 'c', name: 'get_low_stock', args: {} }],
    };
    const { service } = build({
      tools: [readTool('get_low_stock', execute)],
      completions: Array.from({ length: MAX_TOOL_CALLS_PER_TURN }, () => toolCall),
    });

    const result = await service.run('org_1', 'user_1', false, 'go');

    expect(result.capped).toBe(true);
    expect(result.toolCalls).toHaveLength(MAX_TOOL_CALLS_PER_TURN);
    expect(execute).toHaveBeenCalledTimes(MAX_TOOL_CALLS_PER_TURN);
  });

  it('summarises proposals when the model returns no final text', async () => {
    const { service } = build({
      tools: [
        writeTool(
          'create_note',
          jest.fn(() => ({ args: { title: 'x' }, summary: 's' })),
        ),
      ],
      completions: [
        { content: null, toolCalls: [{ id: 'c1', name: 'create_note', args: {} }] },
        { content: null, toolCalls: [] },
      ],
    });

    const result = await service.run('org_1', 'user_1', false, 'note this');

    expect(result.reply).toContain('1 proposal');
  });

  it('grounds the model against inventing business data and names the write tools', async () => {
    const { service, provider } = build({
      tools: [readTool('list_inventory', jest.fn(async () => []))],
      completions: [{ content: 'You have no inventory items yet.', toolCalls: [] }],
    });

    await service.run('org_1', 'user_1', false, 'nionyeshe stoo yangu');

    const calls = (provider.complete as jest.Mock).mock.calls;
    const system = (
      calls[0][0] as Array<{ role: string; content: string }>
    ).find((message) => message.role === 'system');
    expect(system?.content).toContain('NO built-in knowledge');
    expect(system?.content).toContain('Never invent');
    expect(system?.content).toContain('call the matching read tool');
    expect(system?.content).toContain('call create_note');
    expect(system?.content).toContain('list_inventory');
  });

  it('passes an empty read result back so the model can say there is nothing', async () => {
    const execute = jest.fn(async () => []);
    const { service, provider } = build({
      tools: [readTool('list_inventory', execute)],
      completions: [
        {
          content: null,
          toolCalls: [{ id: 'c1', name: 'list_inventory', args: {} }],
        },
        { content: 'You have no inventory items yet.', toolCalls: [] },
      ],
    });

    const result = await service.run('org_1', 'user_1', false, 'stoo yangu iko aje?');

    expect(execute).toHaveBeenCalledWith({}, CTX);
    const calls = (provider.complete as jest.Mock).mock.calls;
    const secondMessages = calls[1][0] as Array<{
      role: string;
      content: string;
    }>;
    const toolMessage = secondMessages.find((message) => message.role === 'tool');
    expect(toolMessage?.content).toBe(JSON.stringify({ result: [] }));
    expect(result.reply).toBe('You have no inventory items yet.');
  });

  it('returns a graceful, retryable reply when the provider fails (no 500)', async () => {
    const { service, provider } = build({
      tools: [readTool('list_inventory', jest.fn(async () => []))],
      completions: [],
    });
    (provider.complete as jest.Mock).mockRejectedValueOnce(
      new Error('gateway timeout'),
    );

    const result = await service.run(
      'org_1',
      'user_1',
      false,
      'what is in my stock?',
    );

    expect(result.reply).toContain("couldn't reach");
    expect(result.proposals).toHaveLength(0);
  });

  it('keeps already-built proposals when a later provider call fails', async () => {
    const tool = writeTool(
      'create_note',
      jest.fn(() => ({ args: { title: 'Plumber' }, summary: 'Create note' })),
    );
    const { service, provider } = build({ tools: [tool], completions: [] });
    (provider.complete as jest.Mock)
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [
          { id: 'c1', name: 'create_note', args: { title: 'Plumber' } },
        ],
      })
      .mockRejectedValueOnce(new Error('gateway down'));

    const result = await service.run('org_1', 'user_1', false, 'draft a note');

    expect(result.proposals).toHaveLength(1);
    expect(result.reply).toContain("couldn't reach");
  });

  it('carries prior conversation turns into the model prompt', async () => {
    const { service, provider } = build({
      tools: [readTool('list_inventory', jest.fn(async () => []))],
      completions: [{ content: 'Nothing yet.', toolCalls: [] }],
    });

    await service.run('org_1', 'user_1', false, 'and now?', [
      { role: 'user', content: 'what is in my stock?' },
      {
        role: 'assistant',
        content: 'You have no inventory items yet.',
        toolCalls: [],
      },
    ]);

    const messages = (
      provider.complete.mock.calls[0] as unknown as Array<
        Array<{ role: string; content: string | null }>
      >
    )[0];
    expect(messages.map((m) => m.role)).toEqual([
      'system',
      'user',
      'assistant',
      'user',
    ]);
    expect(messages[1]).toEqual({
      role: 'user',
      content: 'what is in my stock?',
    });
  });
});
