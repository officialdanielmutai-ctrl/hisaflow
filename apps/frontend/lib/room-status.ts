import type { RoomStatus } from '@/services/rooms.service';

/** Shared room-status presentation so the list, widget and detail agree. */
export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  VACANT_CLEAN: 'Clean',
  VACANT_DIRTY: 'Dirty',
  OCCUPIED: 'Occupied',
  MAINTENANCE: 'Maintenance',
  OUT_OF_ORDER: 'Out of order',
};

export const ROOM_STATUS_BADGE: Record<RoomStatus, string> = {
  VACANT_CLEAN: 'bg-green-100 text-green-700',
  VACANT_DIRTY: 'bg-orange-100 text-orange-700',
  OCCUPIED: 'bg-blue-100 text-blue-700',
  MAINTENANCE: 'bg-red-100 text-red-700',
  OUT_OF_ORDER: 'bg-red-100 text-red-700',
};

/** Statuses a user can set directly; OUT_OF_ORDER goes through fault reporting. */
export const ROOM_STATUS_ORDER: RoomStatus[] = [
  'VACANT_CLEAN',
  'VACANT_DIRTY',
  'OCCUPIED',
  'MAINTENANCE',
];
