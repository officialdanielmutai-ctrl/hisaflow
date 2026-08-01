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
  async getAll(): Promise<Room[]> {
    return apiGet('/rooms');
  },

  async getById(id: string): Promise<Room> {
    return apiGet(`/rooms/${id}`);
  },

  async create(data: Partial<Room>): Promise<Room> {
    return apiPost('/rooms', data);
  },

  async update(id: string, data: Partial<Room>): Promise<Room> {
    return apiPatch(`/rooms/${id}`, data);
  },

  async deactivate(id: string): Promise<Room> {
    return apiDelete(`/rooms/${id}`);
  },
};
