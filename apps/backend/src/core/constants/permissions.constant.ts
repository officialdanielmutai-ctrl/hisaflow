import { OrgRole } from '@prisma/client';

export enum AppPermission {
  canViewAnalytics = 'canViewAnalytics',
  canAddInventory = 'canAddInventory',
  canEditInventory = 'canEditInventory',
  canLogTransactions = 'canLogTransactions',
  canViewFinance = 'canViewFinance',
  canManageStaff = 'canManageStaff', // Special case: implicit OWNER only
}

export const ROLE_BASELINE_PERMISSIONS: Record<OrgRole, AppPermission[]> = {
  OWNER: [
    AppPermission.canViewAnalytics,
    AppPermission.canAddInventory,
    AppPermission.canEditInventory,
    AppPermission.canLogTransactions,
    AppPermission.canViewFinance,
    AppPermission.canManageStaff,
  ],
  MANAGER: [
    AppPermission.canViewAnalytics,
    AppPermission.canAddInventory,
    AppPermission.canEditInventory,
    AppPermission.canLogTransactions,
    AppPermission.canViewFinance,
  ],
  STAFF: [
    AppPermission.canAddInventory,
    AppPermission.canLogTransactions,
  ],
};

/**
 * Pure function to compute the effective permission set for a given role and overrides.
 * `canManageStaff` is heavily guarded and can NEVER be granted to non-OWNER roles.
 */
export function computeEffectivePermissions(
  role: OrgRole,
  grantedPermissions: string[],
  revokedPermissions: string[]
): AppPermission[] {
  const baseline = new Set(ROLE_BASELINE_PERMISSIONS[role]);
  
  // Apply explicitly granted permissions
  for (const perm of grantedPermissions) {
    // Only valid permissions are processed, and we never allow granting `canManageStaff` via override
    if (Object.values(AppPermission).includes(perm as AppPermission) && perm !== AppPermission.canManageStaff) {
      baseline.add(perm as AppPermission);
    }
  }
  
  // Apply explicitly revoked permissions
  for (const perm of revokedPermissions) {
    if (Object.values(AppPermission).includes(perm as AppPermission)) {
      baseline.delete(perm as AppPermission);
    }
  }
  
  return Array.from(baseline);
}
