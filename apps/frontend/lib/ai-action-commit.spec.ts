import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  commitParsedActions,
  isConfirmable,
  type ActionClients,
  type CommittableAction,
} from './ai-action-commit';
import type { ParsedAction } from '@/services/ai-ingestion.service';

function action(
  partial: Partial<CommittableAction> & { type: ParsedAction['type'] },
): CommittableAction {
  return {
    itemId: null,
    itemName: 'Item',
    quantity: 1,
    confidence: 'HIGH',
    ...partial,
  };
}

function clients(): ActionClients {
  return {
    logTransaction: vi.fn().mockResolvedValue(undefined),
    createInventoryItem: vi.fn().mockResolvedValue(undefined),
    updateInventoryItem: vi.fn().mockResolvedValue(undefined),
    createNote: vi.fn().mockResolvedValue(undefined),
    createGuest: vi.fn().mockResolvedValue(undefined),
    createRoom: vi.fn().mockResolvedValue(undefined),
  };
}

describe('commitParsedActions', () => {
  let c: ActionClients;
  beforeEach(() => {
    c = clients();
  });

  it('dispatches each action type to the matching client', async () => {
    const actions: CommittableAction[] = [
      action({ type: 'SALE', itemId: 'i1' }),
      action({ type: 'PURCHASE', itemId: 'i1' }),
      action({ type: 'WASTAGE', itemId: 'i1' }),
      action({ type: 'CREATE', itemName: 'New' }),
      action({ type: 'UPDATE', itemId: 'i1', updates: { sellingPrice: 10 } }),
      action({ type: 'NOTE', itemName: 'Note' }),
      action({ type: 'GUEST', itemName: 'Jane' }),
      action({ type: 'ROOM', itemName: 'Room 1' }),
    ];

    const { outcomes, booking } = await commitParsedActions(actions, c);

    expect(booking).toBeNull();
    expect(outcomes.map((o) => o.status)).toEqual(Array(8).fill('applied'));
    expect(c.logTransaction).toHaveBeenCalledTimes(3);
    expect(c.createInventoryItem).toHaveBeenCalledTimes(1);
    expect(c.updateInventoryItem).toHaveBeenCalledTimes(1);
    expect(c.createNote).toHaveBeenCalledTimes(1);
    expect(c.createGuest).toHaveBeenCalledTimes(1);
    expect(c.createRoom).toHaveBeenCalledTimes(1);
  });

  it('returns bookings as a deferred hand-off and does not commit them', async () => {
    const actions = [action({ type: 'BOOKING', guestName: 'John', roomName: 'Room 3' })];

    const { outcomes, booking } = await commitParsedActions(actions, c);

    expect(outcomes[0].status).toBe('deferred');
    expect(booking?.guestName).toBe('John');
    expect(c.logTransaction).not.toHaveBeenCalled();
  });

  it('skips removed actions', async () => {
    const { outcomes } = await commitParsedActions(
      [action({ type: 'SALE', itemId: 'i1', _removed: true })],
      c,
    );

    expect(outcomes[0].status).toBe('skipped');
    expect(c.logTransaction).not.toHaveBeenCalled();
  });

  it('never re-submits an already-applied action', async () => {
    const { outcomes } = await commitParsedActions(
      [action({ type: 'SALE', itemId: 'i1', _status: 'applied' })],
      c,
    );

    expect(outcomes[0].status).toBe('applied');
    expect(c.logTransaction).not.toHaveBeenCalled();
  });

  it('reports per-action failures and does not re-apply successes on retry', async () => {
    (c.logTransaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (a: CommittableAction) => {
        if (a.itemName === 'Bad') throw new Error('insufficient stock');
      },
    );

    const actions = [
      action({ type: 'SALE', itemId: 'i1', itemName: 'Good' }),
      action({ type: 'SALE', itemId: 'i2', itemName: 'Bad' }),
    ];

    const first = await commitParsedActions(actions, c);
    expect(first.outcomes).toEqual([
      { index: 0, status: 'applied' },
      { index: 1, status: 'failed', error: 'insufficient stock' },
    ]);
    expect(c.logTransaction).toHaveBeenCalledTimes(2);

    // Simulate the UI marking outcomes back onto the actions.
    const afterFirst = actions.map((a, i) => {
      const outcome = first.outcomes[i];
      if (outcome.status === 'applied') return { ...a, _status: 'applied' as const };
      if (outcome.status === 'failed') return { ...a, _status: 'failed' as const };
      return a;
    });

    const second = await commitParsedActions(afterFirst, c);
    expect(second.outcomes).toEqual([
      { index: 0, status: 'applied' },
      { index: 1, status: 'failed', error: 'insufficient stock' },
    ]);
    // Only the failed action was retried.
    expect(c.logTransaction).toHaveBeenCalledTimes(3);
    expect((c.logTransaction as ReturnType<typeof vi.fn>).mock.calls[2][0].itemName).toBe(
      'Bad',
    );
  });

  it('surfaces an unmatched inventory action instead of silently dropping it', async () => {
    const { outcomes } = await commitParsedActions(
      [action({ type: 'SALE', itemId: null, itemName: 'Unknown' })],
      c,
    );

    expect(outcomes[0]).toMatchObject({ status: 'failed' });
    expect(c.logTransaction).not.toHaveBeenCalled();
  });
});

describe('isConfirmable', () => {
  it('rejects removed, applied, and unmatched actions', () => {
    expect(isConfirmable(action({ type: 'SALE', itemId: 'i1' }))).toBe(true);
    expect(isConfirmable(action({ type: 'SALE', itemId: null }))).toBe(false);
    expect(isConfirmable(action({ type: 'SALE', itemId: 'i1', _removed: true }))).toBe(
      false,
    );
    expect(
      isConfirmable(action({ type: 'SALE', itemId: 'i1', _status: 'applied' })),
    ).toBe(false);
  });
});
