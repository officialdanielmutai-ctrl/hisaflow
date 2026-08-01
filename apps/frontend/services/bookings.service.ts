import { apiGet, apiPost, apiPatch } from '@/lib/api-client';
import type { Room } from './rooms.service';
import type { Guest } from './guests.service';
import type { InventoryItem } from './inventory.service';

export interface Booking {
  id: string;
  roomId: string;
  guestId: string;
  status: 'RESERVED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
  checkInDate: string;
  checkOutDate: string;
  actualCheckIn?: string | null;
  actualCheckOut?: string | null;
  ratePerNight: number;
  notes?: string | null;
  room?: Room;
  guest?: Guest;
  consumptions?: any[]; // We can type this better later if needed
}

export const bookingsService = {
  async getAll(token: string, orgId: string): Promise<Booking[]> {
    return apiGet('/bookings', token, orgId);
  },

  async getById(id: string, token: string, orgId: string): Promise<Booking> {
    return apiGet(`/bookings/${id}`, token, orgId);
  },

  async create(data: Partial<Booking>, token: string, orgId: string): Promise<Booking> {
    return apiPost('/bookings', token, orgId, data);
  },

  async checkIn(id: string, token: string, orgId: string): Promise<Booking> {
    return apiPatch(`/bookings/${id}/check-in`, token, orgId, {});
  },

  async checkOut(id: string, force: boolean = false, token: string, orgId: string): Promise<Booking> {
    return apiPatch(`/bookings/${id}/check-out${force ? '?force=true' : ''}`, token, orgId, {});
  },

  async cancel(id: string, token: string, orgId: string): Promise<Booking> {
    return apiPatch(`/bookings/${id}/cancel`, token, orgId, {});
  },

  async addConsumption(id: string, itemId: string, quantity: number, token: string, orgId: string): Promise<any> {
    return apiPost(`/bookings/${id}/consumption`, token, orgId, { itemId, quantity });
  },
};
