import { apiGet, apiPost } from '@/lib/api-client';

export type AssistantProposalStatus =
  | 'PROPOSED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'EXECUTED'
  | 'FAILED';
export type AssistantRiskLevel = 'low' | 'medium' | 'high';

export interface AssistantToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AssistantProposal {
  id: string;
  tool: string;
  summary: string;
  args: Record<string, unknown>;
  diff: unknown;
  riskLevel: AssistantRiskLevel | string;
  status: AssistantProposalStatus;
  version: number;
  createdAt: string;
  expiresAt: string;
  decidedAt: string | null;
}

export interface AssistantToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface AssistantChatResult {
  reply: string | null;
  toolCalls: AssistantToolCall[];
  proposals: AssistantProposal[];
  capped: boolean;
}

export interface AssistantExecutionResult {
  proposalId: string;
  status: 'EXECUTED';
  result: unknown;
  idempotent: boolean;
}

export interface UnsupportedIntent {
  id: string;
  intent: string;
  createdAt: string;
}

export async function getAssistantTools(
  token: string,
  organizationId: string,
): Promise<AssistantToolSchema[]> {
  const response = await apiGet<{ tools: AssistantToolSchema[] }>(
    '/assistant/tools',
    token,
    organizationId,
  );
  return response.tools;
}

export function sendAssistantMessage(
  message: string,
  token: string,
  organizationId: string,
): Promise<AssistantChatResult> {
  return apiPost<AssistantChatResult>('/assistant/chat', token, organizationId, {
    message,
  });
}

export async function listAssistantProposals(
  token: string,
  organizationId: string,
  status?: AssistantProposalStatus,
): Promise<AssistantProposal[]> {
  const query = status ? `?status=${status}` : '';
  const response = await apiGet<{ proposals: AssistantProposal[] }>(
    `/assistant/proposals${query}`,
    token,
    organizationId,
  );
  return response.proposals;
}

export async function approveAssistantProposal(
  id: string,
  token: string,
  organizationId: string,
): Promise<AssistantProposal> {
  const response = await apiPost<{ proposal: AssistantProposal }>(
    `/assistant/proposals/${id}/approve`,
    token,
    organizationId,
    {},
  );
  return response.proposal;
}

export async function rejectAssistantProposal(
  id: string,
  token: string,
  organizationId: string,
): Promise<AssistantProposal> {
  const response = await apiPost<{ proposal: AssistantProposal }>(
    `/assistant/proposals/${id}/reject`,
    token,
    organizationId,
    {},
  );
  return response.proposal;
}

export async function reviseAssistantProposal(
  id: string,
  args: Record<string, unknown>,
  token: string,
  organizationId: string,
): Promise<AssistantProposal> {
  const response = await apiPost<{ proposal: AssistantProposal }>(
    `/assistant/proposals/${id}/revise`,
    token,
    organizationId,
    { args },
  );
  return response.proposal;
}

export function executeAssistantProposal(
  id: string,
  token: string,
  organizationId: string,
): Promise<AssistantExecutionResult> {
  return apiPost<AssistantExecutionResult>(
    `/assistant/proposals/${id}/execute`,
    token,
    organizationId,
    {},
  );
}

export async function getUnsupportedIntents(
  token: string,
  organizationId: string,
): Promise<UnsupportedIntent[]> {
  const response = await apiGet<{ intents: UnsupportedIntent[] }>(
    '/assistant/unsupported',
    token,
    organizationId,
  );
  return response.intents;
}
