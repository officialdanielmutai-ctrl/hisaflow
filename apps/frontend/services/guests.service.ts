import { apiGet, apiPost, apiPatch } from '@/lib/api-client';

export interface Guest {
  id: string;
  name: string;
  phone?: string | null;
  idNumber?: string | null;
  email?: string | null;
  notes?: string | null;
}

export const guestsService = {
  async getAll(token: string, orgId: string): Promise<Guest[]> {
    return apiGet('/guests', token, orgId);
  },

  async getById(id: string, token: string, orgId: string): Promise<Guest> {
    return apiGet(`/guests/${id}`, token, orgId);
  },

  async create(data: Partial<Guest>, token: string, orgId: string): Promise<Guest> {
    return apiPost('/guests', token, orgId, data);
  },

  async update(id: string, data: Partial<Guest>, token: string, orgId: string): Promise<Guest> {
    return apiPatch(`/guests/${id}`, token, orgId, data);
  },
};
