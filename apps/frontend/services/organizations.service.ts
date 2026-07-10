import { apiGet, apiPost } from '@/lib/api-client';

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
  name: string | null;
  email: string | null;
  role: 'OWNER' | 'MANAGER' | 'STAFF';
  joinedAt: string;
}

export async function getMyOrganizations(
  token: string,
): Promise<OrgMembership[]> {
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
): Promise<{ inviteCode: string; orgName: string }> {
  return apiGet('/organizations/my/invite-code', token, 'none');
}

export async function regenerateInviteCode(
  token: string,
): Promise<{ inviteCode: string; orgName: string }> {
  return apiPost('/organizations/my/invite-code/regenerate', token, 'none', {});
}

export async function getStaffMembers(
  token: string,
): Promise<StaffMember[]> {
  return apiGet('/organizations/my/staff', token, 'none');
}
