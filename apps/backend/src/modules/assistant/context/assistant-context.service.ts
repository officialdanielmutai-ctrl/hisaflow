import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntitlementsService } from '../../../core/entitlements/entitlements.service';
import { AppRole } from '../../../core/decorators/roles.decorator';
import { PrismaService } from '../../../infrastructure/prisma.service';
import type { ToolContext } from '../tool.types';

/**
 * Builds the trusted execution context from the authenticated session only.
 * The model never supplies organizationId/userId/role — the server injects
 * them here, and every tool receives them via `ToolContext`.
 */
@Injectable()
export class AssistantContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async build(
    organizationId: string,
    userId: string,
    isImpersonated: boolean,
  ): Promise<ToolContext> {
    const [organization, membership, entitlements] = await Promise.all([
      this.prisma.db.organization.findUnique({
        where: { id: organizationId },
        select: { businessType: true },
      }),
      this.prisma.db.orgMembership.findFirst({
        where: { userId, organizationId },
        select: { role: true },
      }),
      this.entitlements.resolve(organizationId),
    ]);

    if (!organization) {
      throw new NotFoundException('Organization not found.');
    }
    if (!membership) {
      throw new ForbiddenException('Not a member of this organization.');
    }

    return {
      organizationId,
      userId,
      role: membership.role as unknown as AppRole,
      businessType: organization.businessType,
      tier: entitlements.tier,
      isImpersonated,
    };
  }
}
