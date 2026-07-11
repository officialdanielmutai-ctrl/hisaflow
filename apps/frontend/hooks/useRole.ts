'use client';

import { useMyOrganization } from './useMyOrganization';

export function useRole() {
  const { membership } = useMyOrganization();
  const role = membership?.role ?? null;

  const isOwner = role === 'OWNER';
  const isManager = role === 'MANAGER';
  const isStaff = role === 'STAFF';

  return {
    role,
    isOwner,
    isManager,
    isStaff,
    canViewAnalytics: isOwner || isManager,
    // All roles can add new stock items
    canAddInventory: true,
    // Only owners/managers can edit existing items or log manual transactions
    canEditInventory: isOwner || isManager,
    canLogTransactions: true,
  };
}