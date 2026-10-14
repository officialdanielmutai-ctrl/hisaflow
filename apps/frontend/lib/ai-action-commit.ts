import type { ParsedAction } from '@/services/ai-ingestion.service';

/**
 * Client-side commit loop for AI-ingestion actions (overhaul Duty 1/Duty 2).
 *
 * The previous loop re-submitted *every* action on every press and only logged
 * failures, so a partial failure followed by a retry could apply the same
 * stock movement twice. This module makes the loop idempotent:
 *
 *  - an action already marked `applied` is never sent again;
 *  - each action gets an explicit outcome (applied / failed / skipped /
 *    deferred) so the UI can show per-action results;
 *  - booking actions are returned to the caller as a hand-off, not committed.
 *
 * The clients are injected, so this logic is unit-testable without network.
 * Phase B replaces this path with the server-side proposal executor; until
 * then this is the smallest safe fix.
 */
export type ActionStatus = 'pending' | 'applied' | 'failed';

export interface CommittableAction extends ParsedAction {
  _removed?: boolean;
  _status?: ActionStatus;
  _error?: string;
}

export interface ActionClients {
  logTransaction: (action: CommittableAction) => Promise<unknown>;
  createInventoryItem: (action: CommittableAction) => Promise<unknown>;
  updateInventoryItem: (action: CommittableAction) => Promise<unknown>;
  createNote: (action: CommittableAction) => Promise<unknown>;
  createGuest: (action: CommittableAction) => Promise<unknown>;
  createRoom: (action: CommittableAction) => Promise<unknown>;
}

export type ActionOutcomeStatus = 'applied' | 'failed' | 'skipped' | 'deferred';

export interface ActionOutcome {
  index: number;
  status: ActionOutcomeStatus;
  error?: string;
}

export interface CommitResult {
  outcomes: ActionOutcome[];
  /** Booking actions are handed off to the booking form, never committed here. */
  booking: CommittableAction | null;
}

function isInventoryTransaction(action: CommittableAction): boolean {
  return (
    action.type === 'SALE' ||
    action.type === 'PURCHASE' ||
    action.type === 'WASTAGE'
  );
}

export function isConfirmable(action: CommittableAction): boolean {
  if (action._removed || action._status === 'applied') return false;
  switch (action.type) {
    case 'SALE':
    case 'PURCHASE':
    case 'WASTAGE':
      return Boolean(action.itemId);
    case 'UPDATE':
      return Boolean(action.itemId && action.updates);
    case 'CREATE':
    case 'NOTE':
    case 'BOOKING':
    case 'GUEST':
    case 'ROOM':
      return true;
    default:
      return false;
  }
}

export async function commitParsedActions(
  actions: CommittableAction[],
  clients: ActionClients,
): Promise<CommitResult> {
  const outcomes: ActionOutcome[] = [];
  let booking: CommittableAction | null = null;

  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index];

    if (action._removed) {
      outcomes.push({ index, status: 'skipped' });
      continue;
    }
    // Idempotency: never re-send an action that already applied.
    if (action._status === 'applied') {
      outcomes.push({ index, status: 'applied' });
      continue;
    }

    try {
      if (isInventoryTransaction(action)) {
        if (!action.itemId) {
          throw new Error('No matching inventory item found.');
        }
        await clients.logTransaction(action);
      } else if (action.type === 'CREATE') {
        await clients.createInventoryItem(action);
      } else if (action.type === 'UPDATE') {
        if (!action.itemId || !action.updates) {
          throw new Error('Nothing to update.');
        }
        await clients.updateInventoryItem(action);
      } else if (action.type === 'NOTE') {
        await clients.createNote(action);
      } else if (action.type === 'GUEST') {
        await clients.createGuest(action);
      } else if (action.type === 'ROOM') {
        await clients.createRoom(action);
      } else if (action.type === 'BOOKING') {
        booking = action;
        outcomes.push({ index, status: 'deferred' });
        continue;
      } else {
        throw new Error(`Unsupported action type: ${action.type}`);
      }
      outcomes.push({ index, status: 'applied' });
    } catch (error) {
      outcomes.push({
        index,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Action failed',
      });
    }
  }

  return { outcomes, booking };
}

export type ActionDestination =
  | '/inventory'
  | '/transactions'
  | '/notes'
  | '/guests'
  | '/rooms';

/**
 * Where the user should land once AI actions are applied, so the result
 * mirrors the request: a note opens Notes, a guest opens Guests, a stock
 * movement opens the transaction ledger, and so on. For a multi-action
 * request the first applied action wins, which keeps the destination
 * deterministic and predictable.
 */
export function completionRoute(
  applied: Array<Pick<CommittableAction, 'type'>>,
): ActionDestination {
  const first = applied[0];
  if (!first) return '/inventory';
  switch (first.type) {
    case 'NOTE':
      return '/notes';
    case 'GUEST':
      return '/guests';
    case 'ROOM':
      return '/rooms';
    case 'SALE':
    case 'PURCHASE':
    case 'WASTAGE':
      return '/transactions';
    case 'CREATE':
    case 'UPDATE':
    default:
      return '/inventory';
  }
}
