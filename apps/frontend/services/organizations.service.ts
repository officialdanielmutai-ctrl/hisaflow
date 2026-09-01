import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';

export interface OrgMembership {
  id: string;
  role: 'OWNER' | 'MANAGER' | 'STAFF';
  organization: {
    id: string;
    name: string;
    businessType: string;
    currency: string;
    country: string;
  };
}

export interface StaffMember {
  userId: string;
  clerkId: string;
  name: string | null;
  email: string | null;
  role: 'OWNER' | 'MANAGER' | 'STAFF';
  joinedAt: string;
  grantedPermissions: string[];
  revokedPermissions: string[];
  effectivePermissions: string[];
}

export async function getMyOrganizations(token: string): Promise<OrgMembership[]> {
  return apiGet<OrgMembership[]>('/organizations/me', token, 'none');
}

export async function joinOrganization(
  inviteCode: string,
  token: string,
): Promise<{ message: string; orgName: string }> {
  return apiPost('/organizations/join', token, 'none', { inviteCode });
}

export async function getMyInviteCode(
  token: string,
  orgId: string,
): Promise<{ inviteCode: string; orgName: string }> {
  return apiGet('/organizations/my/invite-code', token, orgId);
}

export async function regenerateInviteCode(
  token: string,
  orgId: string,
): Promise<{ inviteCode: string; orgName: string }> {
  return apiPost('/organizations/my/invite-code/regenerate', token, orgId, {});
}

export async function getStaffMembers(
  token: string,
  orgId: string,
): Promise<StaffMember[]> {
  return apiGet('/organizations/my/staff', token, orgId);
}

export async function getMyPermissions(
  token: string,
  orgId: string,
): Promise<string[]> {
  return apiGet('/organizations/my/permissions', token, orgId);
}

export async function removeStaffMember(
  token: string,
  orgId: string,
  userId: string,
): Promise<void> {
  return apiDelete(`/organizations/staff/${userId}`, token, orgId);
}

export async function updateStaffPermissions(
  token: string,
  orgId: string,
  userId: string,
  grantedPermissions: string[],
  revokedPermissions: string[],
): Promise<StaffMember> {
  return apiPatch(`/organizations/staff/${userId}/permissions`, token, orgId, {
    grantedPermissions,
    revokedPermissions,
  });
}
