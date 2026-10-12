import { ForbiddenException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { FeatureFlagScope } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';

export const ASSISTANT_FLAGS = {
  read: 'assistant.read',
  write: 'assistant.write',
  communicate: 'assistant.communicate',
  booking: 'assistant.booking',
} as const;

export interface FlagContext {
  organizationId: string;
  businessType: string;
}

/** Deterministic 0-99 bucket so a partial rollout is stable per org. */
export function rolloutBucket(organizationId: string): number {
  const digest = createHash('sha256').update(organizationId).digest('hex');
  return parseInt(digest.slice(0, 8), 16) % 100;
}

/**
 * Feature flags are a table, not a boolean (owner decision 2026-10-11).
 * Resolution is ORGANIZATION > BUSINESS_TYPE > GLOBAL; the most specific scope
 * wins. Unknown keys are **denied** by default.
 */
@Injectable()
export class FeatureFlagService {
  constructor(private readonly prisma: PrismaService) {}

  async isEnabled(key: string, ctx: FlagContext): Promise<boolean> {
    const flags = await this.prisma.db.featureFlag.findMany({
      where: {
        key,
        OR: [
          {
            scope: FeatureFlagScope.ORGANIZATION,
            scopeValue: ctx.organizationId,
          },
          { scope: FeatureFlagScope.BUSINESS_TYPE, scopeValue: ctx.businessType },
          { scope: FeatureFlagScope.GLOBAL, scopeValue: '' },
        ],
      },
      orderBy: { scope: 'desc' },
    });

    const match = flags[0];
    if (!match || !match.enabled) return false;
    if (match.rolloutPct >= 100) return true;
    if (match.rolloutPct <= 0) return false;
    return rolloutBucket(ctx.organizationId) < match.rolloutPct;
  }

  async assertEnabled(key: string, ctx: FlagContext): Promise<void> {
    if (!(await this.isEnabled(key, ctx))) {
      throw new ForbiddenException(
        `The assistant feature "${key}" is not enabled for this organization.`,
      );
    }
  }
}
