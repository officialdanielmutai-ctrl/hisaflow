import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';

export interface Room {
  id: string;
  name: string;
  type: string;
  baseRate: number;
  status: 'VACANT_CLEAN' | 'VACANT_DIRTY' | 'OCCUPIED' | 'MAINTENANCE';
  isActive: boolean;
  notes?: string | null;
}

export const roomsService = {
  async getAll(token: string, orgId: string): Promise<Room[]> {
    return apiGet('/rooms', token, orgId);
  },

  async getById(id: string, token: string, orgId: string): Promise<Room> {
    return apiGet(`/rooms/${id}`, token, orgId);
  },

  async create(data: Partial<Room>, token: string, orgId: string): Promise<Room> {
    return apiPost('/rooms', token, orgId, data);
  },

  async update(id: string, data: Partial<Room>, token: string, orgId: string): Promise<Room> {
    return apiPatch(`/rooms/${id}`, token, orgId, data);
  },

  async deactivate(id: string, token: string, orgId: string): Promise<Room> {
    return apiDelete(`/rooms/${id}`, token, orgId);
  },
};
