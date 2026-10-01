import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, AppRole } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { FEATURES_KEY } from '../decorators/requires-features.decorator';
import { AppPermission, computeEffectivePermissions } from '../constants/permissions.constant';
import { TierFeature } from '../entitlements/entitlements.constant';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { PrismaService } from '../../infrastructure/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
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
    const requiredFeatures = this.reflector.getAllAndOverride<TierFeature[]>(FEATURES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const hasRoles = Boolean(requiredRoles && requiredRoles.length > 0);
    const hasPermissions = Boolean(requiredPermissions && requiredPermissions.length > 0);
    const hasFeatures = Boolean(requiredFeatures && requiredFeatures.length > 0);

    if (!hasRoles && !hasPermissions && !hasFeatures) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id as string | undefined;
    const organizationId = request.headers['x-organization-id'] as string | undefined;

    // View-As mode: allow reading any role-protected resource, but reject mutations
    if (request.user?.isImpersonated === true) {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
        throw new ForbiddenException('Mutations are disabled in Admin View-As (Read-Only) mode');
      }
      return true;
    }

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

    // ── Tier dimension (Section 1A floor/depth) ──────────────────────────────
    // Runs after membership so a non-member still gets the membership error,
    // and before role/permission checks so a Solo owner hitting a Team feature
    // is routed to the paywall with that context rather than a generic 403.
    if (hasFeatures) {
      await this.entitlements.assertFeatures(organizationId, requiredFeatures!);
    }

    let roleMatched = true;
    if (hasRoles) {
      roleMatched = requiredRoles!.includes(membership.role as AppRole);
    }

    let permissionsMatched = true;
    if (hasPermissions) {
      const effectivePermissions = computeEffectivePermissions(
        membership.role,
        membership.grantedPermissions,
        membership.revokedPermissions
      );
      permissionsMatched = requiredPermissions!.every((perm) => effectivePermissions.includes(perm));
    }

    if (roleMatched && permissionsMatched) {
      return true;
    }

    throw new ForbiddenException('Insufficient permissions');
  }
}
