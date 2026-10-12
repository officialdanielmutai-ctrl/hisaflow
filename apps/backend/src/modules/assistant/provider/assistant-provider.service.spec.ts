import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssistantProviderService } from './assistant-provider.service';
import type { AgentMessage } from '../agent/agent.types';

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import OpenAI from 'openai';

const MockedOpenAI = OpenAI as unknown as jest.Mock;

function build(options: {
  baseUrl?: string;
  apiKey?: string;
  message?: Record<string, unknown>;
} = {}) {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'litellm.baseUrl') return options.baseUrl;
      if (key === 'litellm.masterKey') return options.apiKey;
      return undefined;
    }),
  };
  const create = jest.fn().mockResolvedValue({
    choices: [{ message: options.message ?? { content: 'hello' } }],
  });
  MockedOpenAI.mockImplementation(() => ({ chat: { completions: { create } } }));
  const service = new AssistantProviderService(config as unknown as ConfigService);
  return { service, create };
}

const CONFIGURED = { baseUrl: 'http://litellm.local/v1', apiKey: 'key' };

describe('AssistantProviderService', () => {
  beforeEach(() => MockedOpenAI.mockReset());

  it('throws when the gateway is not configured', async () => {
    const { service } = build();
    await expect(service.complete([], [])).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('uses the dedicated assistant model and returns parsed tool calls', async () => {
    const { service, create } = build({
      ...CONFIGURED,
      message: {
        content: null,
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'get_low_stock', arguments: '{"limit":5}' },
          },
        ],
      },
    });

    const result = await service.complete([], [
      { name: 'get_low_stock', description: 'd', parameters: { type: 'object' } },
    ]);

    expect(create.mock.calls[0][0].model).toBe('hisaflow-assistant');
    expect(create.mock.calls[0][0].tools).toEqual([
      {
        type: 'function',
        function: {
          name: 'get_low_stock',
          description: 'd',
          parameters: { type: 'object' },
        },
      },
    ]);
    expect(result.toolCalls).toEqual([
      { id: 'call_1', name: 'get_low_stock', args: { limit: 5 } },
    ]);
  });

  it('maps internal messages to the OpenAI tool-call shape', async () => {
    const { service, create } = build(CONFIGURED);
    const messages: AgentMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: null,
        toolCalls: [{ id: 'c1', name: 'get_low_stock', args: { limit: 5 } }],
      },
      { role: 'tool', toolCallId: 'c1', content: '{"result":[]}' },
    ];

    await service.complete(messages, []);

    const sent = create.mock.calls[0][0].messages;
    expect(sent[2]).toMatchObject({
      role: 'assistant',
      tool_calls: [
        {
          id: 'c1',
          type: 'function',
          function: { name: 'get_low_stock', arguments: '{"limit":5}' },
        },
      ],
    });
    expect(sent[3]).toEqual({
      role: 'tool',
      tool_call_id: 'c1',
      content: '{"result":[]}',
    });
  });
});
