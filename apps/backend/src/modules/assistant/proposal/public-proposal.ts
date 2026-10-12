import type {
  AssistantProposal,
  AssistantProposalStatus,
} from '@prisma/client';

export interface PublicProposal {
  id: string;
  tool: string;
  summary: string;
  args: Record<string, unknown>;
  diff: unknown;
  riskLevel: string;
  status: AssistantProposalStatus;
  version: number;
  createdAt: string;
  expiresAt: string;
  decidedAt: string | null;
}

function parse(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** Safe, client-facing view of a proposal (no internal ids/keys). */
export function toPublicProposal(proposal: AssistantProposal): PublicProposal {
  return {
    id: proposal.id,
    tool: proposal.tool,
    summary: proposal.summary,
    args: (parse(proposal.argsJson) ?? {}) as Record<string, unknown>,
    diff: parse(proposal.diffJson),
    riskLevel: proposal.riskLevel,
    status: proposal.status,
    version: proposal.version,
    createdAt: proposal.createdAt.toISOString(),
    expiresAt: proposal.expiresAt.toISOString(),
    decidedAt: proposal.decidedAt ? proposal.decidedAt.toISOString() : null,
  };
}
