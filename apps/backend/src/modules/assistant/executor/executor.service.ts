import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AssistantAuditService } from './assistant-audit.service';
import { ToolRegistryService } from '../registry/tool-registry.service';
import { AssistantPolicyService } from '../policy/policy.service';
import { hashArgs } from '../proposal/proposal.service';
import type { ToolContext } from '../tool.types';

export interface ExecutionResult {
  proposalId: string;
  status: 'EXECUTED';
  result: unknown;
  idempotent: boolean;
}

function parseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * The only code allowed to commit an assistant write/communicate action.
 * It re-checks, at execution time: tenant scope, approval status, the approved
 * args hash (immutability), policy (role/tier/flag), then commits through the
 * same domain service the manual UI uses and writes an audit record.
 */
@Injectable()
export class AssistantExecutorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ToolRegistryService,
    private readonly policy: AssistantPolicyService,
    private readonly audit: AssistantAuditService,
  ) {}

  async execute(
    organizationId: string,
    ctx: ToolContext,
    proposalId: string,
  ): Promise<ExecutionResult> {
    const proposal = await this.prisma.db.assistantProposal.findFirst({
      where: { id: proposalId, organizationId },
    });
    if (!proposal) {
      throw new NotFoundException('Proposal not found.');
    }

    // Idempotency: an already-executed proposal returns its stored result and
    // never runs the commit again.
    if (proposal.status === 'EXECUTED') {
      return {
        proposalId: proposal.id,
        status: 'EXECUTED',
        result: parseJson(proposal.resultJson),
        idempotent: true,
      };
    }

    if (proposal.status !== 'APPROVED') {
      throw new ForbiddenException(
        'Proposal must be approved before it can be executed.',
      );
    }

    const args = JSON.parse(proposal.argsJson) as Record<string, unknown>;
    if (hashArgs(args) !== proposal.argsHash) {
      throw new BadRequestException(
        'Proposal arguments changed after approval; refusing to execute.',
      );
    }

    const tool = this.registry.assertKnown(proposal.tool);
    if (!tool.commit) {
      throw new BadRequestException(
        `Tool "${tool.name}" is not executable.`,
      );
    }

    // Re-evaluate policy at execution time (role/tier/flag may have changed).
    await this.policy.assertToolAllowed(tool, ctx);

    await this.audit.record({
      organizationId,
      userId: ctx.userId,
      proposalId: proposal.id,
      tool: tool.name,
      action: 'execute_start',
    });

    try {
      const result = await tool.commit(args, ctx);
      await this.prisma.db.assistantProposal.update({
        where: { id: proposal.id },
        data: {
          status: 'EXECUTED',
          executedAt: new Date(),
          resultJson: JSON.stringify(result ?? null),
          errorMessage: null,
        },
      });
      await this.audit.record({
        organizationId,
        userId: ctx.userId,
        proposalId: proposal.id,
        tool: tool.name,
        action: 'executed',
        detail: { result },
      });
      return {
        proposalId: proposal.id,
        status: 'EXECUTED',
        result,
        idempotent: false,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Execution failed.';
      await this.prisma.db.assistantProposal.update({
        where: { id: proposal.id },
        data: { status: 'FAILED', errorMessage: message },
      });
      await this.audit.record({
        organizationId,
        userId: ctx.userId,
        proposalId: proposal.id,
        tool: tool.name,
        action: 'execute_failed',
        detail: { message },
      });
      throw error;
    }
  }
}
