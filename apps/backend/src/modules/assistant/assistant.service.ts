import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AssistantProposalStatus } from '@prisma/client';
import { AssistantContextService } from './context/assistant-context.service';
import { ToolRegistryService } from './registry/tool-registry.service';
import { AssistantPolicyService } from './policy/policy.service';
import { ProposalService } from './proposal/proposal.service';
import { toPublicProposal } from './proposal/public-proposal';
import type { PublicProposal } from './proposal/public-proposal';
import { AssistantExecutorService } from './executor/executor.service';
import { AssistantAgentService } from './agent/assistant-agent.service';
import { AssistantUnsupportedService } from './unsupported/assistant-unsupported.service';
import {
  AssistantMemoryService,
  type ConversationSummary,
  type StoredMessage,
} from './memory/assistant-memory.service';
import type { AgentResult } from './agent/agent.types';
import type { ToolContext } from './tool.types';

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
    private readonly agent: AssistantAgentService,
    private readonly unsupported: AssistantUnsupportedService,
    private readonly memory: AssistantMemoryService,
  ) {}

  buildContext(
    organizationId: string,
    userId: string,
    isImpersonated: boolean,
  ): Promise<ToolContext> {
    return this.context.build(organizationId, userId, isImpersonated);
  }

  async listTools(
    organizationId: string,
    userId: string,
    isImpersonated: boolean,
  ) {
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
    return toPublicProposal(proposal);
  }

  /**
   * Edit a proposal: re-validate the new args through the tool and create a
   * new version, then reject the superseded one. An approved payload is never
   * mutated in place.
   */
  async revise(
    ctx: ToolContext,
    id: string,
    args: Record<string, unknown>,
  ): Promise<PublicProposal> {
    const previous = await this.proposals.getScoped(ctx.organizationId, id);
    if (!previous) {
      throw new NotFoundException('Proposal not found.');
    }
    if (previous.status !== 'PROPOSED' && previous.status !== 'APPROVED') {
      throw new BadRequestException(
        'Only proposed or approved proposals can be edited.',
      );
    }
    const tool = this.registry.assertKnown(previous.tool);
    if (!tool.buildProposal) {
      throw new BadRequestException('Tool cannot be edited.');
    }
    await this.policy.assertToolAllowed(tool, ctx);
    const draft = await tool.buildProposal(args, ctx);
    const revised = await this.proposals.revise(ctx, previous, tool, draft);
    await this.proposals.reject(ctx.organizationId, id, ctx.userId);
    return toPublicProposal(revised);
  }

  /**
   * Conversational entry point: the tool-calling agent loop, wrapped in
   * short-lived thread memory. The memory is pruned on every turn so old
   * chats are deleted as new ones pile on. `conversationId` is optional; an
   * unknown/expired id starts a fresh thread rather than failing.
   */
  async chat(
    organizationId: string,
    userId: string,
    isImpersonated: boolean,
    message: string,
    conversationId?: string,
  ): Promise<AgentResult & { conversationId: string }> {
    const existing = conversationId
      ? await this.memory.getScoped(organizationId, userId, conversationId)
      : null;
    const conversation =
      existing ?? (await this.memory.start(organizationId, userId, message));

    const history = await this.memory.history(
      conversation.id,
      organizationId,
    );
    await this.memory.append(
      conversation.id,
      organizationId,
      userId,
      'user',
      message,
    );

    const result = await this.agent.run(
      organizationId,
      userId,
      isImpersonated,
      message,
      history,
    );

    await this.memory.append(
      conversation.id,
      organizationId,
      userId,
      'assistant',
      result.reply ?? '',
    );
    await this.memory.prune(organizationId, userId);

    return { ...result, conversationId: conversation.id };
  }

  /** The user's recent assistant threads, newest first. */
  listConversations(
    organizationId: string,
    userId: string,
  ): Promise<ConversationSummary[]> {
    return this.memory.list(organizationId, userId);
  }

  /** Full stored messages for one scoped thread. */
  getConversationMessages(
    organizationId: string,
    userId: string,
    conversationId: string,
  ): Promise<StoredMessage[]> {
    return this.memory.getMessages(organizationId, userId, conversationId);
  }

  async listProposals(
    organizationId: string,
    status?: AssistantProposalStatus,
  ): Promise<PublicProposal[]> {
    const proposals = await this.proposals.list(organizationId, status);
    return proposals.map((proposal) => toPublicProposal(proposal));
  }

  async approve(
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<PublicProposal> {
    return toPublicProposal(
      await this.proposals.approve(organizationId, id, userId),
    );
  }

  async reject(
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<PublicProposal> {
    return toPublicProposal(
      await this.proposals.reject(organizationId, id, userId),
    );
  }

  execute(organizationId: string, ctx: ToolContext, id: string) {
    return this.executor.execute(organizationId, ctx, id);
  }

  /** Unsupported-intent events for the team to review. */
  listUnsupportedIntents(organizationId: string, limit?: number) {
    return this.unsupported.list(organizationId, limit);
  }
}
