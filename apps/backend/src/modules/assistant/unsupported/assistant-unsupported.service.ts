import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { redactUtterance } from '../../ai-ingestion/lib/redact-utterance';

/**
 * Fallback capture (overhaul Duty 2, Phase E): when a request cannot be mapped
 * to a tool, the assistant records an anonymised unsupported-intent event so
 * the product backlog is driven by real gaps. Never blocks the reply.
 */
@Injectable()
export class AssistantUnsupportedService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    organizationId: string,
    userId: string,
    intent: string,
  ): Promise<{ recorded: boolean }> {
    const redacted = redactUtterance(intent).slice(0, 1000);
    if (!redacted) return { recorded: false };

    await this.prisma.db.unsupportedIntent.create({
      data: { organizationId, userId, intent: redacted },
    });
    return { recorded: true };
  }

  async list(organizationId: string, limit = 50) {
    return this.prisma.db.unsupportedIntent.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }
}
