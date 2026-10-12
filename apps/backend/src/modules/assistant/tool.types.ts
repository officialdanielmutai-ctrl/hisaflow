import type { AppRole } from '../../core/decorators/roles.decorator';
import type { TierFeature } from '../../core/entitlements/entitlements.constant';

/**
 * Typed tool contract for the assistant (overhaul Duty 2, Section 3.3).
 *
 * Capabilities live here, not in a prompt. `read`/`utility` tools run through
 * `execute`; `write`/`communicate` tools must never mutate — they only build a
 * proposal, and only the executor calls their `commit`.
 */
export type ToolKind = 'read' | 'write' | 'communicate' | 'utility';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface ToolContext {
  organizationId: string;
  userId: string;
  role: AppRole;
  businessType: string;
  tier: string;
  isImpersonated: boolean;
}

export interface ProposalDraft {
  /** Validated, normalised arguments. The executor runs exactly these. */
  args: Record<string, unknown>;
  summary: string;
  diff?: unknown;
  riskLevel?: RiskLevel;
}

/** Model-facing JSON-schema description of a tool. Never contains identity. */
export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  kind: ToolKind;
  riskLevel: RiskLevel;
  parameters: Record<string, unknown>;
  /** Roles allowed to use the tool. Omitted = any role. */
  roles?: AppRole[];
  /** Business types the tool applies to. Omitted/empty = all verticals. */
  verticals?: string[];
  /** Optional tier feature the org must be entitled to. */
  feature?: TierFeature;
  /** read/utility only — runs immediately, must be side-effect free. */
  execute?: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
  /** write/communicate only — build the proposal, no side effects. */
  buildProposal?: (
    args: Record<string, unknown>,
    ctx: ToolContext,
  ) => Promise<ProposalDraft> | ProposalDraft;
  /** write/communicate only — the single governed commit. */
  commit?: (
    args: Record<string, unknown>,
    ctx: ToolContext,
  ) => Promise<unknown>;
}
