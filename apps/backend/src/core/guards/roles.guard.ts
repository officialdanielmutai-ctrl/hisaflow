import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, AppRole } from '../decorators/roles.decorator';
import { PrismaService } from '../../infrastructure/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles decorator on this route — allow through
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id as string | undefined;
    const organizationId = request.headers['x-organization-id'] as string | undefined;

    if (!userId || !organizationId) {
      throw new ForbiddenException('No role assigned');
    }

    // Look up the user's actual role from the database membership
    const membership = await this.prisma.db.orgMembership.findFirst({
      where: { userId, organizationId },
      select: { role: true },
    });

    if (!membership) {
      throw new ForbiddenException('No membership found for this organization');
    }

    if (requiredRoles.includes(membership.role as AppRole)) {
      return true;
    }

    throw new ForbiddenException('Insufficient permissions');
  }
}