import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type {
  AgentCompletion,
  AgentMessage,
  AgentToolCall,
} from '../agent/agent.types';
import type { ToolSchema } from '../tool.types';

/** Dedicated, ordered, tool-verified model group (see gateway config). */
export const ASSISTANT_MODEL = 'hisaflow-assistant';

function parseArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function toOpenAiMessage(
  message: AgentMessage,
): OpenAI.Chat.Completions.ChatCompletionMessageParam {
  if (message.role === 'assistant') {
    if (message.toolCalls.length === 0) {
      return { role: 'assistant', content: message.content ?? '' };
    }
    return {
      role: 'assistant',
      content: message.content,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: 'function' as const,
        function: {
          name: call.name,
          arguments: JSON.stringify(call.args),
        },
      })),
    };
  }
  if (message.role === 'tool') {
    return {
      role: 'tool',
      tool_call_id: message.toolCallId,
      content: message.content,
    };
  }
  return { role: message.role, content: message.content };
}

/**
 * Provider layer: the only place the assistant talks to LiteLLM. Uses the
 * dedicated `hisaflow-assistant` model group (ordered, non-shuffled, only
 * tool-calling-spike-verified models) at low temperature.
 */
@Injectable()
export class AssistantProviderService {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('litellm.baseUrl') &&
        this.config.get<string>('litellm.masterKey'),
    );
  }

  async complete(
    messages: AgentMessage[],
    tools: ToolSchema[],
  ): Promise<AgentCompletion> {
    const baseUrl = this.config.get<string>('litellm.baseUrl');
    const apiKey = this.config.get<string>('litellm.masterKey');
    if (!baseUrl || !apiKey) {
      throw new ServiceUnavailableException('AI gateway is not configured.');
    }

    const openai = new OpenAI({ baseURL: baseUrl, apiKey });
    const response = await openai.chat.completions.create({
      model: ASSISTANT_MODEL,
      messages: messages.map(toOpenAiMessage),
      tools: tools.map((tool) => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters as OpenAI.FunctionParameters,
        },
      })),
      tool_choice: 'auto',
      temperature: 0.1,
    });

    const message = response.choices?.[0]?.message;
    const toolCalls: AgentToolCall[] = (message?.tool_calls ?? []).flatMap(
      (call) => {
        if (call.type !== 'function') return [];
        return [
          {
            id: call.id,
            name: call.function.name,
            args: parseArgs(call.function.arguments),
          },
        ];
      },
    );

    return { content: message?.content ?? null, toolCalls };
  }
}
