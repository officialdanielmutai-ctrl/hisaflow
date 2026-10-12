import type { ParsedAction } from '../../ai-ingestion/ai-ingestion.service';
import { stableStringify } from '../proposal/proposal.service';

/** A provider-agnostic tool call used for comparison. */
export interface MappedCall {
  tool: string;
  args: Record<string, unknown>;
}

function defined(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(args).filter(([, value]) => value !== undefined && value !== null),
  );
}

/**
 * Maps a legacy `ParsedAction` (the prompt-heavy path) onto the equivalent new
 * tool call, so shadow mode can compare "what the old prompt decided" with
 * "what the registry decided". Actions with no DUKA tool return null.
 */
export function legacyActionToCall(action: ParsedAction): MappedCall | null {
  switch (action.type) {
    case 'SALE':
      return {
        tool: 'record_sale',
        args: defined({ itemId: action.itemId, quantity: action.quantity }),
      };
    case 'PURCHASE':
      return {
        tool: 'record_purchase',
        args: defined({ itemId: action.itemId, quantity: action.quantity }),
      };
    case 'WASTAGE':
      return {
        tool: 'record_wastage',
        args: defined({
          itemId: action.itemId,
          quantity: action.quantity,
          wastageReason: action.wastageReason,
        }),
      };
    case 'CREATE':
      return {
        tool: 'create_inventory_item',
        args: defined({
          name: action.itemName,
          unit: action.unit,
          quantity: action.quantity,
          reorderThreshold: action.reorderThreshold,
          costPrice: action.costPrice,
          sellingPrice: action.sellingPrice,
          category: action.category,
        }),
      };
    case 'UPDATE':
      return {
        tool: 'update_inventory_item',
        args: defined({ itemId: action.itemId, updates: action.updates }),
      };
    case 'NOTE':
      return {
        tool: 'create_note',
        args: defined({
          title: action.title,
          content: action.content,
          importance: action.importance,
        }),
      };
    default:
      return null;
  }
}

export function legacyActionsToCalls(actions: ParsedAction[]): MappedCall[] {
  return actions
    .map(legacyActionToCall)
    .filter((call): call is MappedCall => call !== null);
}

/** Only write/communicate tools are comparable with the legacy action list. */
export const SHADOW_COMPARABLE_TOOLS = new Set([
  'record_sale',
  'record_purchase',
  'record_wastage',
  'create_inventory_item',
  'update_inventory_item',
  'create_note',
]);

export function isShadowComparable(tool: string): boolean {
  return SHADOW_COMPARABLE_TOOLS.has(tool);
}

export function fingerprint(call: MappedCall): string {
  return `${call.tool}|${stableStringify(call.args)}`;
}

/** Tool + primary subject, so argument drift still matches as "partial". */
export function softKey(call: MappedCall): string {
  const subject =
    call.args.itemId ??
    call.args.name ??
    call.args.title ??
    call.args.guestName ??
    '';
  return `${call.tool}|${String(subject)}`;
}

export interface ShadowDetail {
  tool: string;
  nextTool: string | null;
  reason: 'exact' | 'args-differ' | 'missing';
}

export interface ShadowReport {
  legacyCount: number;
  nextCount: number;
  exact: number;
  partial: number;
  missing: number;
  extra: number;
  /** Exact matches / legacy count (0 when there is nothing to compare). */
  score: number;
  details: ShadowDetail[];
}

/**
 * Compares the legacy path's mapped calls with the new registry's calls.
 * Matching is order-independent; a same-tool/same-subject call with different
 * arguments counts as `partial`.
 */
export function compareCalls(
  legacy: MappedCall[],
  next: MappedCall[],
): ShadowReport {
  const pool = [...next];
  const details: ShadowDetail[] = [];
  let exact = 0;
  let partial = 0;
  let missing = 0;

  for (const legacyCall of legacy) {
    const exactIndex = pool.findIndex(
      (candidate) => fingerprint(candidate) === fingerprint(legacyCall),
    );
    if (exactIndex >= 0) {
      const [match] = pool.splice(exactIndex, 1);
      exact += 1;
      details.push({ tool: legacyCall.tool, nextTool: match.tool, reason: 'exact' });
      continue;
    }

    const softIndex = pool.findIndex(
      (candidate) => softKey(candidate) === softKey(legacyCall),
    );
    if (softIndex >= 0) {
      const [match] = pool.splice(softIndex, 1);
      partial += 1;
      details.push({
        tool: legacyCall.tool,
        nextTool: match.tool,
        reason: 'args-differ',
      });
      continue;
    }

    missing += 1;
    details.push({ tool: legacyCall.tool, nextTool: null, reason: 'missing' });
  }

  const legacyCount = legacy.length;
  return {
    legacyCount,
    nextCount: next.length,
    exact,
    partial,
    missing,
    extra: pool.length,
    score: legacyCount === 0 ? 1 : exact / legacyCount,
    details,
  };
}
