'use client';

import { useOrganization } from '@clerk/nextjs';

export function useRole() {
  const { membership } = useOrganization();
  const role = (membership?.role as string) ?? null;

  const isOwner = role === 'org:owner' || role === 'OWNER';
  const isManager = role === 'org:manager' || role === 'MANAGER';
  const isStaff = role === 'org:member' || role === 'STAFF';

  return {
    role,
    isOwner,
    isManager,
    isStaff,
    canViewAnalytics: isOwner || isManager,
    canManageInventory: isOwner || isManager,
    canLogTransactions: true,
  };
}
