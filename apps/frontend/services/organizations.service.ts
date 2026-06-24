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
