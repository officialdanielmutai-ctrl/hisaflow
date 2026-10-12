import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AssistantProposal, AssistantProposalStatus } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma.service';
import type { ProposalDraft, ToolContext, ToolDefinition } from '../tool.types';

export const PROPOSAL_TTL_MS = 30 * 60 * 1000;

/** Deterministic JSON so the same args always hash the same. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  // Omit undefined-valued keys, exactly like JSON.stringify, so the hash of
  // the draft args matches the hash of the parsed stored args.
  const keys = Object.keys(record)
    .filter((key) => typeof record[key] !== 'undefined')
    .sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

export function hashArgs(args: unknown): string {
  return createHash('sha256').update(stableStringify(args)).digest('hex');
}

/**
 * Durable proposal store. Approved proposals are immutable: a new edit creates
 * a new version that must be re-approved (the executor also verifies the hash).
 */
@Injectable()
export class ProposalService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    ctx: ToolContext,
    tool: ToolDefinition,
    draft: ProposalDraft,
    options: { version?: number } = {},
  ): Promise<AssistantProposal> {
    const argsHash = hashArgs(draft.args);
    const now = new Date();
    return this.prisma.db.assistantProposal.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        tool: tool.name,
        argsJson: JSON.stringify(draft.args),
        argsHash,
        summary: draft.summary,
        diffJson: draft.diff === undefined ? null : JSON.stringify(draft.diff),
        riskLevel: draft.riskLevel ?? tool.riskLevel,
        idempotencyKey: randomUUID(),
        version: options.version ?? 1,
        expiresAt: new Date(now.getTime() + PROPOSAL_TTL_MS),
      },
    });
  }

  /**
   * Create a new version of an edited proposal. The previous proposal stays
   * as-is (its caller marks it rejected), so an approved payload is never
   * mutated in place.
   */
  revise(
    ctx: ToolContext,
    previous: AssistantProposal,
    tool: ToolDefinition,
    draft: ProposalDraft,
  ): Promise<AssistantProposal> {
    return this.create(ctx, tool, draft, { version: previous.version + 1 });
  }

  /** Tenant-scoped fetch: another org's id returns null, never a row. */
  async getScoped(
    organizationId: string,
    id: string,
  ): Promise<AssistantProposal | null> {
    return this.prisma.db.assistantProposal.findFirst({
      where: { id, organizationId },
    });
  }

  async list(
    organizationId: string,
    status?: AssistantProposalStatus,
  ): Promise<AssistantProposal[]> {
    return this.prisma.db.assistantProposal.findMany({
      where: { organizationId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async approve(
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<AssistantProposal> {
    const proposal = await this.requireScoped(organizationId, id);
    if (proposal.status !== 'PROPOSED') {
      throw new BadRequestException(
        `Proposal is ${proposal.status.toLowerCase()} and cannot be approved.`,
      );
    }
    if (proposal.expiresAt.getTime() < Date.now()) {
      await this.prisma.db.assistantProposal.update({
        where: { id: proposal.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Proposal has expired. Create a new one.');
    }
    return this.prisma.db.assistantProposal.update({
      where: { id: proposal.id },
      data: { status: 'APPROVED', decidedAt: new Date(), decidedBy: userId },
    });
  }

  async reject(
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<AssistantProposal> {
    const proposal = await this.requireScoped(organizationId, id);
    if (proposal.status !== 'PROPOSED' && proposal.status !== 'APPROVED') {
      throw new BadRequestException(
        `Proposal is ${proposal.status.toLowerCase()} and cannot be rejected.`,
      );
    }
    return this.prisma.db.assistantProposal.update({
      where: { id: proposal.id },
      data: { status: 'REJECTED', decidedAt: new Date(), decidedBy: userId },
    });
  }

  private async requireScoped(
    organizationId: string,
    id: string,
  ): Promise<AssistantProposal> {
    const proposal = await this.getScoped(organizationId, id);
    if (!proposal) {
      throw new NotFoundException('Proposal not found.');
    }
    return proposal;
  }
}
