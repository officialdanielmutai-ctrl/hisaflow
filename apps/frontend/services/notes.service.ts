import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';

export type NoteImportance = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type NoteStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';

export interface ChecklistItem {
  id: string;
  noteId: string;
  text: string;
  isCompleted: boolean;
  order: number;
}

export interface Note {
  id: string;
  organizationId: string;
  title: string;
  content: string | null;
  importance: NoteImportance;
  status: NoteStatus;
  dueDate: string | null;
  isPinned: boolean;
  createdAt: string;
  author: {
    name: string | null;
    clerkId: string;
  };
  checklistItems: ChecklistItem[];
}

export async function getNotes(
  token: string,
  orgId: string,
  filters?: { status?: string; from?: string; to?: string }
): Promise<Note[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.from) params.append('from', filters.from);
  if (filters?.to) params.append('to', filters.to);

  const query = params.toString();
  const path = query ? `/notes?${query}` : '/notes';
  return apiGet<Note[]>(path, token, orgId);
}

export async function createNote(
  token: string,
  orgId: string,
  data: {
    title: string;
    content?: string;
    importance?: NoteImportance;
    dueDate?: string;
    checklistItems?: { text: string }[];
  }
): Promise<Note> {
  return apiPost<Note>('/notes', token, orgId, data);
}

export async function updateNote(
  noteId: string,
  token: string,
  orgId: string,
  data: Partial<Note>
): Promise<Note> {
  return apiPatch<Note>(`/notes/${noteId}`, token, orgId, data);
}

export async function deleteNote(
  noteId: string,
  token: string,
  orgId: string
): Promise<void> {
  return apiDelete(`/notes/${noteId}`, token, orgId);
}

export async function addChecklistItem(
  noteId: string,
  text: string,
  token: string,
  orgId: string
): Promise<ChecklistItem> {
  return apiPost<ChecklistItem>(`/notes/${noteId}/items`, token, orgId, { text });
}

export async function toggleChecklistItem(
  itemId: string,
  token: string,
  orgId: string
): Promise<ChecklistItem> {
  return apiPatch<ChecklistItem>(`/notes/items/${itemId}/toggle`, token, orgId, {});
}

export async function deleteChecklistItem(
  itemId: string,
  token: string,
  orgId: string
): Promise<void> {
  return apiDelete(`/notes/items/${itemId}`, token, orgId);
}
