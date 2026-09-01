import { SetMetadata } from '@nestjs/common';
import { AppPermission } from '../constants/permissions.constant';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: AppPermission[]) => SetMetadata(PERMISSIONS_KEY, permissions);
