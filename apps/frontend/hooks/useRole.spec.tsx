import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  membership: null as any,
  perms: undefined as string[] | undefined,
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'tok' }),
}));

vi.mock('swr', () => ({
  default: () => ({ data: state.perms }),
}));

vi.mock('@/hooks/useMyOrganization', () => ({
  useMyOrganization: () => ({ membership: state.membership }),
}));

vi.mock('@/services/organizations.service', () => ({
  getMyPermissions: vi.fn(async () => state.perms ?? []),
}));

import { useRole } from './useRole';

const membership = (role: string, businessType: string) => ({
  role,
  organization: { id: 'org_1', businessType },
});

describe('useRole', () => {
  beforeEach(() => {
    state.membership = null;
    state.perms = undefined;
  });

  it('derives role and industry flags from the membership', () => {
    state.membership = membership('OWNER', 'DUKA');

    const { result } = renderHook(() => useRole());

    expect(result.current.role).toBe('OWNER');
    expect(result.current.isOwner).toBe(true);
    expect(result.current.isStaff).toBe(false);
    expect(result.current.isDuka).toBe(true);
    expect(result.current.isRetail).toBe(true);
    expect(result.current.isIsp).toBe(false);
  });

  it('falls back to role baselines while permissions are loading', () => {
    state.membership = membership('STAFF', 'DUKA');

    const { result } = renderHook(() => useRole());

    expect(result.current.canAddInventory).toBe(true);
    expect(result.current.canLogTransactions).toBe(true);
    expect(result.current.canViewAnalytics).toBe(false);
    expect(result.current.canViewFinance).toBe(false);
    expect(result.current.canManageStaff).toBe(false);
  });

  it('uses resolved effective permissions once loaded', () => {
    state.membership = membership('STAFF', 'DUKA');
    state.perms = ['canViewFinance'];

    const { result } = renderHook(() => useRole());

    expect(result.current.canViewFinance).toBe(true);
    expect(result.current.canAddInventory).toBe(false);
    expect(result.current.effectivePermissions).toEqual(['canViewFinance']);
  });

  it('grants the owner baseline capabilities and ISP flag', () => {
    state.membership = membership('OWNER', 'ISP');

    const { result } = renderHook(() => useRole());

    expect(result.current.canManageStaff).toBe(true);
    expect(result.current.canViewFinance).toBe(true);
    expect(result.current.isIsp).toBe(true);
    expect(result.current.isOwner).toBe(true);
  });

  it('handles a missing membership without throwing', () => {
    const { result } = renderHook(() => useRole());

    expect(result.current.role).toBeNull();
    expect(result.current.businessType).toBeNull();
    expect(result.current.isOwner).toBe(false);
    expect(result.current.effectivePermissions).toBeNull();
  });
});
