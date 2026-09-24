import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@prisma/client';
import { ADMIN_ROLES_KEY } from '../decorators/require-admin-roles.decorator';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(ADMIN_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const adminUser = request.adminUser;

    if (!adminUser) {
      throw new ForbiddenException('Admin context missing');
    }

    // Super Admin has unrestricted access to all operations
    if (adminUser.role === AdminRole.SUPER_ADMIN) {
      return true;
    }

    const hasRole = requiredRoles.includes(adminUser.role);
    if (!hasRole) {
      throw new ForbiddenException(
        `Insufficient role permissions. Required: [${requiredRoles.join(', ')}], current: ${adminUser.role}`,
      );
    }

    return true;
  }
}
