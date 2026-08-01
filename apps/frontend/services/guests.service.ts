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
  async getAll(): Promise<Guest[]> {
    return apiGet('/guests');
  },

  async getById(id: string): Promise<Guest> {
    return apiGet(`/guests/${id}`);
  },

  async create(data: Partial<Guest>): Promise<Guest> {
    return apiPost('/guests', data);
  },

  async update(id: string, data: Partial<Guest>): Promise<Guest> {
    return apiPatch(`/guests/${id}`, data);
  },
};
