import type {
  AssistantProposalStatus,
  AssistantRiskLevel,
  AssistantToolSchema,
} from '@/services/assistant.service';

/** Human labels for the DUKA tool registry (unknown tools fall back to name). */
export const TOOL_LABELS: Record<string, string> = {
  get_low_stock: 'Low stock',
  search_inventory: 'Inventory search',
  record_sale: 'Record sale',
  record_purchase: 'Record purchase',
  record_wastage: 'Record wastage',
  create_inventory_item: 'New inventory item',
  update_inventory_item: 'Update inventory item',
  create_note: 'Create note',
};

export function toolLabel(tool: string): string {
  return TOOL_LABELS[tool] ?? tool.replace(/_/g, ' ');
}

/**
 * Suggestion chips are generated from the tools the org actually has, so they
 * never offer a capability that is not in the registry.
 */
const TOOL_SUGGESTIONS: Record<string, string> = {
  get_low_stock: 'What is low on stock?',
  search_inventory: 'Do we have cooking oil?',
  record_sale: 'Sold 3 unga',
  record_purchase: 'Received 10 sugar',
  record_wastage: '2 milk expired',
  create_inventory_item: 'Add a new item: 5 litres cooking oil',
  update_inventory_item: 'Change the price of sugar',
  create_note: 'Remind me to do stock count on Friday',
};

export function suggestionsForTools(
  tools: AssistantToolSchema[],
  limit = 4,
): string[] {
  return tools
    .map((tool) => TOOL_SUGGESTIONS[tool.name])
    .filter((suggestion): suggestion is string => Boolean(suggestion))
    .slice(0, limit);
}

export interface DiffRow {
  field: string;
  before: string;
  after: string;
}

export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return new Intl.NumberFormat('en-KE').format(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Turns the backend's flexible diff shapes into before/after rows:
 *  - `{ before: {...}, after: {...} }` (create/update/note)
 *  - `{ item, quantity: { before, after } }` (stock transactions)
 */
export function extractDiffRows(diff: unknown): DiffRow[] {
  if (!isRecord(diff)) return [];
  const rows: DiffRow[] = [];

  if (diff.before !== undefined || diff.after !== undefined) {
    const before = isRecord(diff.before) ? diff.before : {};
    const after = isRecord(diff.after) ? diff.after : {};
    const keys = Array.from(
      new Set([...Object.keys(before), ...Object.keys(after)]),
    );
    for (const key of keys) {
      rows.push({
        field: key,
        before: displayValue(before[key]),
        after: displayValue(after[key]),
      });
    }
    return rows;
  }

  for (const [key, value] of Object.entries(diff)) {
    if (isRecord(value) && ('before' in value || 'after' in value)) {
      rows.push({
        field: key,
        before: displayValue(value.before),
        after: displayValue(value.after),
      });
    }
  }
  return rows;
}

export function proposalStatusLabel(status: AssistantProposalStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function proposalStatusTone(status: AssistantProposalStatus): string {
  switch (status) {
    case 'PROPOSED':
      return 'bg-amber-100 text-amber-800 border border-amber-200';
    case 'APPROVED':
      return 'bg-blue-100 text-blue-800 border border-blue-200';
    case 'EXECUTED':
      return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    case 'FAILED':
      return 'bg-red-100 text-red-700 border border-red-200';
    case 'REJECTED':
    case 'EXPIRED':
    default:
      return 'bg-gray-100 text-gray-600 border border-gray-200';
  }
}

export function riskLabel(risk: AssistantRiskLevel | string): string {
  switch (risk) {
    case 'high':
      return 'High risk';
    case 'medium':
      return 'Medium risk';
    default:
      return 'Low risk';
  }
}

export function isEditableScalar(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

/** Preserve the original primitive type when an edit comes back as text. */
export function coerceField(value: string, original: unknown): unknown {
  if (typeof original === 'number') {
    const num = Number(value);
    return Number.isFinite(num) ? num : value;
  }
  if (typeof original === 'boolean') {
    return value === 'true';
  }
  return value;
}
