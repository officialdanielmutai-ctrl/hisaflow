import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '@prisma/client';

export const ADMIN_ROLES_KEY = 'adminRoles';
export const RequireAdminRoles = (...roles: AdminRole[]) => SetMetadata(ADMIN_ROLES_KEY, roles);
