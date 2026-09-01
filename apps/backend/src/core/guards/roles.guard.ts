import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, AppRole } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AppPermission, computeEffectivePermissions } from '../constants/permissions.constant';
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
    const requiredPermissions = this.reflector.getAllAndOverride<AppPermission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if ((!requiredRoles || requiredRoles.length === 0) && (!requiredPermissions || requiredPermissions.length === 0)) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id as string | undefined;
    const organizationId = request.headers['x-organization-id'] as string | undefined;

    if (!userId || !organizationId) {
      throw new ForbiddenException('Organization context missing');
    }

    const membership = await this.prisma.db.orgMembership.findFirst({
      where: { userId, organizationId },
      select: { role: true, grantedPermissions: true, revokedPermissions: true },
    });

    if (!membership) {
      throw new ForbiddenException('No membership found for this organization');
    }

    let roleMatched = true;
    if (requiredRoles && requiredRoles.length > 0) {
      roleMatched = requiredRoles.includes(membership.role as AppRole);
    }

    let permissionsMatched = true;
    if (requiredPermissions && requiredPermissions.length > 0) {
      const effectivePermissions = computeEffectivePermissions(
        membership.role,
        membership.grantedPermissions,
        membership.revokedPermissions
      );
      permissionsMatched = requiredPermissions.every((perm) => effectivePermissions.includes(perm));
    }

    if (roleMatched && permissionsMatched) {
      return true;
    }

    throw new ForbiddenException('Insufficient permissions');
  }
}