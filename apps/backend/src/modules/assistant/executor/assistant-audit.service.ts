import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';

export interface AuditEntry {
  organizationId: string;
  userId?: string;
  proposalId?: string;
  tool?: string;
  action: string;
  detail?: unknown;
}

/** Privacy-safe audit trail for the single governed write path. */
@Injectable()
export class AssistantAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.prisma.db.assistantAuditLog.create({
      data: {
        organizationId: entry.organizationId,
        userId: entry.userId ?? null,
        proposalId: entry.proposalId ?? null,
        tool: entry.tool ?? null,
        action: entry.action,
        detailJson:
          entry.detail === undefined ? null : JSON.stringify(entry.detail),
      },
    });
  }
}
