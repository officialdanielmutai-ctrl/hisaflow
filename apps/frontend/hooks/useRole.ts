'use client';

import { useMyOrganization } from './useMyOrganization';

export function useRole() {
  const { membership } = useMyOrganization();
  const role = membership?.role ?? null;
  const businessType = membership?.organization?.businessType ?? null;

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

  // Retail group (all share the same nav/feature set with wholesale variations)
  const isRetail = isDuka || isMiniMart || isWholesaler;

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
    isRetail,
    canViewAnalytics: isOwner || isManager,
    canAddInventory: true,
    canEditInventory: isOwner || isManager,
    canLogTransactions: true,
  };
}