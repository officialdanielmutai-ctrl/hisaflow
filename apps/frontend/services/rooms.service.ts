import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';

export type RoomStatus =
  | 'VACANT_CLEAN'
  | 'VACANT_DIRTY'
  | 'OCCUPIED'
  | 'MAINTENANCE'
  | 'OUT_OF_ORDER';

export interface Room {
  id: string;
  name: string;
  type: string;
  baseRate: number;
  status: RoomStatus;
  isActive: boolean;
  notes?: string | null;
}

export type RoomIssueStatus = 'OPEN' | 'RESOLVED';

export interface RoomIssue {
  id: string;
  roomId: string;
  description: string;
  category: string;
  cost: number | null;
  status: RoomIssueStatus;
  reportedByName?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface CreateRoomIssuePayload {
  description: string;
  category?: string;
  cost?: number;
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

  async getIssues(id: string, token: string, orgId: string): Promise<RoomIssue[]> {
    return apiGet(`/rooms/${id}/issues`, token, orgId);
  },

  async reportIssue(
    id: string,
    payload: CreateRoomIssuePayload,
    token: string,
    orgId: string,
  ): Promise<RoomIssue> {
    return apiPost(`/rooms/${id}/issues`, token, orgId, payload);
  },

  async resolveIssue(issueId: string, token: string, orgId: string): Promise<RoomIssue> {
    return apiPatch(`/rooms/issues/${issueId}/resolve`, token, orgId, {});
  },
};
