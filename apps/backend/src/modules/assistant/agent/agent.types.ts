import type { PublicProposal } from '../proposal/public-proposal';

/** A tool call as returned by the model (parsed arguments). */
export interface AgentToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/** Internal, provider-agnostic conversation message. */
export type AgentMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; toolCalls: AgentToolCall[] }
  | { role: 'tool'; toolCallId: string; content: string };

export interface AgentCompletion {
  content: string | null;
  toolCalls: AgentToolCall[];
}

export interface AgentResult {
  reply: string | null;
  toolCalls: AgentToolCall[];
  proposals: PublicProposal[];
  /** True when the per-turn tool-call cap was reached. */
  capped: boolean;
}
