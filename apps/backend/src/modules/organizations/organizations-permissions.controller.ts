import { Controller, Get, UseGuards, ForbiddenException } from '@nestjs/common';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { OrgContext } from '../../core/decorators/org-context.decorator';
import { PrismaService } from '../../infrastructure/prisma.service';
import { computeEffectivePermissions } from '../../core/constants/permissions.constant';

@UseGuards(ClerkAuthGuard)
@Controller('organizations')
export class OrganizationsPermissionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('my/permissions')
  async getMyPermissions(
    @CurrentUser() user: { id: string },
    @OrgContext() orgId: string,
  ) {
    if (!orgId) {
      throw new ForbiddenException('Organization context missing');
    }

    const membership = await this.prisma.db.orgMembership.findFirst({
      where: { userId: user.id, organizationId: orgId },
      select: { role: true, grantedPermissions: true, revokedPermissions: true },
    });

    if (!membership) {
      throw new ForbiddenException('No membership found for this organization');
    }

    const effectivePermissions = computeEffectivePermissions(
      membership.role,
      membership.grantedPermissions,
      membership.revokedPermissions
    );

    return effectivePermissions;
  }
}
