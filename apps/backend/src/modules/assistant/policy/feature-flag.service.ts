import { ForbiddenException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { FeatureFlagScope } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';

export const ASSISTANT_FLAGS = {
  read: 'assistant.read',
  write: 'assistant.write',
  communicate: 'assistant.communicate',
  booking: 'assistant.booking',
  shadow: 'assistant.shadow',
} as const;

/**
 * Capabilities that are **enabled when no explicit flag row exists**.
 *
 * The assistant must work out of the box in every vertical, so read, write and
 * communicate default on. This is not a weakening of the kill switch: an
 * explicit row (organization > business type > global) always wins and can
 * disable a capability, and unknown keys stay denied. `assistant.shadow` and
 * `assistant.booking` remain off by default.
 */
export const DEFAULT_ENABLED_FLAGS: ReadonlySet<string> = new Set([
  ASSISTANT_FLAGS.read,
  ASSISTANT_FLAGS.write,
  ASSISTANT_FLAGS.communicate,
]);

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
 * wins. `DEFAULT_ENABLED_FLAGS` are on when no row exists (so the assistant
 * works across all verticals without a manual seed); every other key is denied
 * by default. Production applies the schema with `prisma db push`, so this code
 * default — not a data migration — is what makes the assistant usable.
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
    if (!match) return DEFAULT_ENABLED_FLAGS.has(key);
    if (!match.enabled) return false;
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
