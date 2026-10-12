import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import type {
  AssistantProposal,
  AssistantProposalStatus,
} from '@prisma/client';
import { AssistantContextService } from './context/assistant-context.service';
import { ToolRegistryService } from './registry/tool-registry.service';
import { AssistantPolicyService } from './policy/policy.service';
import { ProposalService } from './proposal/proposal.service';
import { AssistantExecutorService } from './executor/executor.service';
import type { ToolContext } from './tool.types';

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

/**
 * Application-facing assistant orchestration: list tools, run read tools, and
 * create/review/execute proposals. Writes never run here — only the executor
 * commits, and only after approval.
 */
@Injectable()
export class AssistantService {
  constructor(
    private readonly context: AssistantContextService,
    private readonly registry: ToolRegistryService,
    private readonly policy: AssistantPolicyService,
    private readonly proposals: ProposalService,
    private readonly executor: AssistantExecutorService,
  ) {}

  buildContext(
    organizationId: string,
    userId: string,
    isImpersonated: boolean,
  ): Promise<ToolContext> {
    return this.context.build(organizationId, userId, isImpersonated);
  }

  async listTools(organizationId: string, userId: string, isImpersonated: boolean) {
    const ctx = await this.context.build(organizationId, userId, isImpersonated);
    return this.registry.toSchemas(this.registry.listFor(ctx));
  }

  async runReadTool(
    ctx: ToolContext,
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const tool = this.registry.assertKnown(name);
    if (tool.kind !== 'read' && tool.kind !== 'utility') {
      throw new BadRequestException(`Tool "${name}" is not a read tool.`);
    }
    if (!tool.execute) {
      throw new BadRequestException(`Tool "${name}" cannot run.`);
    }
    await this.policy.assertToolAllowed(tool, ctx);
    return tool.execute(args, ctx);
  }

  async propose(
    ctx: ToolContext,
    name: string,
    args: Record<string, unknown>,
  ): Promise<PublicProposal> {
    const tool = this.registry.assertKnown(name);
    if (tool.kind !== 'write' && tool.kind !== 'communicate') {
      throw new BadRequestException(`Tool "${name}" is not a proposal tool.`);
    }
    if (!tool.buildProposal) {
      throw new BadRequestException(`Tool "${name}" cannot be proposed.`);
    }
    await this.policy.assertToolAllowed(tool, ctx);
    const draft = await tool.buildProposal(args, ctx);
    const proposal = await this.proposals.create(ctx, tool, draft);
    return this.toPublic(proposal);
  }

  async listProposals(
    organizationId: string,
    status?: AssistantProposalStatus,
  ): Promise<PublicProposal[]> {
    const proposals = await this.proposals.list(organizationId, status);
    return proposals.map((proposal) => this.toPublic(proposal));
  }

  async approve(
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<PublicProposal> {
    return this.toPublic(
      await this.proposals.approve(organizationId, id, userId),
    );
  }

  async reject(
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<PublicProposal> {
    return this.toPublic(
      await this.proposals.reject(organizationId, id, userId),
    );
  }

  execute(organizationId: string, ctx: ToolContext, id: string) {
    return this.executor.execute(organizationId, ctx, id);
  }

  private toPublic(proposal: AssistantProposal): PublicProposal {
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
}
