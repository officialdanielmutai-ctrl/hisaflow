import type { CreateRoomIssuePayload } from '@/services/rooms.service';

export const ROOM_ISSUE_CATEGORY_OPTIONS = [
  { value: 'REPAIR', label: 'General repair', emoji: '🛠️' },
  { value: 'PLUMBING', label: 'Plumbing', emoji: '🚿' },
  { value: 'ELECTRICAL', label: 'Electrical', emoji: '💡' },
  { value: 'APPLIANCE', label: 'Appliance', emoji: '📺' },
  { value: 'CLEANING', label: 'Deep cleaning', emoji: '🧹' },
  { value: 'OTHER', label: 'Other', emoji: '📝' },
] as const;

export interface RoomIssueFormValues {
  description: string;
  category: string;
  cost: string;
}

export interface RoomIssueFormErrors {
  description?: string;
  cost?: string;
}

/**
 * The reporter's note is mandatory: a fault cannot be logged without saying
 * what broke. Cost is optional but, when supplied, must be a valid non-negative
 * amount.
 */
export function validateRoomIssue(values: RoomIssueFormValues): RoomIssueFormErrors {
  const errors: RoomIssueFormErrors = {};

  if (!values.description.trim()) {
    errors.description = 'Describe what broke — this is required.';
  }

  if (values.cost.trim()) {
    const amount = Number(values.cost);
    if (!Number.isFinite(amount) || amount < 0) {
      errors.cost = 'Enter a valid cost (0 or more).';
    }
  }

  return errors;
}

export function roomIssuePayload(values: RoomIssueFormValues): CreateRoomIssuePayload {
  const payload: CreateRoomIssuePayload = {
    description: values.description.trim(),
    category: values.category,
  };
  if (values.cost.trim()) {
    payload.cost = Number(values.cost);
  }
  return payload;
}
