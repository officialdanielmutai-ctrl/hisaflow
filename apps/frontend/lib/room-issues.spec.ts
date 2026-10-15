import { describe, it, expect } from 'vitest';
import { roomIssuePayload, validateRoomIssue } from './room-issues';

describe('room issue validation', () => {
  it('requires a description note from the reporter', () => {
    const errors = validateRoomIssue({ description: '   ', category: 'REPAIR', cost: '' });
    expect(errors.description).toBeTruthy();
  });

  it('accepts a note without a cost', () => {
    const errors = validateRoomIssue({
      description: 'Window latch is broken',
      category: 'REPAIR',
      cost: '',
    });
    expect(errors).toEqual({});
  });

  it('rejects a negative or non-numeric cost', () => {
    expect(
      validateRoomIssue({ description: 'Broken TV', category: 'APPLIANCE', cost: '-5' }).cost,
    ).toBeTruthy();
    expect(
      validateRoomIssue({ description: 'Broken TV', category: 'APPLIANCE', cost: 'abc' }).cost,
    ).toBeTruthy();
  });

  it('builds a payload with a trimmed note and optional numeric cost', () => {
    expect(
      roomIssuePayload({ description: '  Burst pipe  ', category: 'PLUMBING', cost: '2500' }),
    ).toEqual({ description: 'Burst pipe', category: 'PLUMBING', cost: 2500 });

    expect(
      roomIssuePayload({ description: 'Blown bulb', category: 'ELECTRICAL', cost: '' }),
    ).toEqual({ description: 'Blown bulb', category: 'ELECTRICAL' });
  });
});
