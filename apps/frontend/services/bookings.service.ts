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
  async getAll(): Promise<Booking[]> {
    return apiGet('/bookings');
  },

  async getById(id: string): Promise<Booking> {
    return apiGet(`/bookings/${id}`);
  },

  async create(data: Partial<Booking>): Promise<Booking> {
    return apiPost('/bookings', data);
  },

  async checkIn(id: string): Promise<Booking> {
    return apiPatch(`/bookings/${id}/check-in`);
  },

  async checkOut(id: string, force: boolean = false): Promise<Booking> {
    return apiPatch(`/bookings/${id}/check-out${force ? '?force=true' : ''}`);
  },

  async cancel(id: string): Promise<Booking> {
    return apiPatch(`/bookings/${id}/cancel`);
  },

  async addConsumption(id: string, itemId: string, quantity: number): Promise<any> {
    return apiPost(`/bookings/${id}/consumption`, { itemId, quantity });
  },
};
