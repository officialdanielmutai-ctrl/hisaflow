'use client';

import { useMyOrganization } from './useMyOrganization';
import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';
import { getMyPermissions } from '@/services/organizations.service';

// The fixed set of permissions that can be toggled per-staff member.
// This mirrors AppPermission in the backend — one source of truth per role.
export const ALL_PERMISSIONS = [
  'canViewAnalytics',
  'canAddInventory',
  'canEditInventory',
  'canLogTransactions',
  'canViewFinance',
] as const;

export type AppPermissionKey = (typeof ALL_PERMISSIONS)[number] | 'canManageStaff';

export function useRole() {
  const { membership } = useMyOrganization();
  const { getToken } = useAuth();

  const role = membership?.role ?? null;
  const orgId = membership?.organization?.id ?? null;
  const businessType = membership?.organization?.businessType ?? null;

  // Fetch effective permissions from backend (respects per-staff overrides)
  const { data: effectivePermissions } = useSWR<string[]>(
    role && orgId ? ['permissions', orgId] : null,
    async () => {
      const token = await getToken();
      if (!token || !orgId) return [];
      return getMyPermissions(token, orgId);
    },
    {
      dedupingInterval: 30_000,
      revalidateOnFocus: false,
    },
  );

  // Role identity flags
  const isOwner = role === 'OWNER';
  const isManager = role === 'MANAGER';
  const isStaff = role === 'STAFF';

  // Industry-specific flags
  const isGuestHouse = businessType === 'GUEST_HOUSE';
  const isChemist = businessType === 'CHEMIST';
  const isRestaurant = businessType === 'RESTAURANT';
  const isWholesaler = businessType === 'WHOLESALER';
  const isDuka = businessType === 'DUKA';
  const isMiniMart = businessType === 'MINI_MART';
  const isSchool = businessType === 'SCHOOL';
  const isIsp = businessType === 'ISP';

  // Retail group
  const isRetail = isDuka || isMiniMart || isWholesaler;

  // Helper: check a permission from the resolved effective set.
  // Falls back gracefully to role-based baseline while the fetch is in flight.
  const has = (perm: AppPermissionKey): boolean => {
    if (effectivePermissions) return effectivePermissions.includes(perm);
    // Role baseline fallback (mirrors backend ROLE_BASELINE_PERMISSIONS)
    if (perm === 'canManageStaff') return isOwner;
    if (perm === 'canViewAnalytics') return isOwner || isManager;
    if (perm === 'canEditInventory') return isOwner || isManager;
    if (perm === 'canViewFinance') return isOwner || isManager;
    if (perm === 'canAddInventory') return true;
    if (perm === 'canLogTransactions') return true;
    return false;
  };

  return {
    role,
    businessType,
    isOwner,
    isManager,
    isStaff,
    isGuestHouse,
    isChemist,
    isRestaurant,
    isWholesaler,
    isDuka,
    isMiniMart,
    isSchool,
    isIsp,
    isRetail,
    // Permission flags — sourced from backend effective permissions
    canViewAnalytics: has('canViewAnalytics'),
    canAddInventory: has('canAddInventory'),
    canEditInventory: has('canEditInventory'),
    canLogTransactions: has('canLogTransactions'),
    canViewFinance: has('canViewFinance'),
    canManageStaff: has('canManageStaff'),
    // Raw effective permissions array for the StaffManagementCard
    effectivePermissions: effectivePermissions ?? null,
  };
}