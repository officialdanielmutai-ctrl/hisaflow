import type {
  AssistantProposalStatus,
  AssistantRiskLevel,
  AssistantToolSchema,
} from '@/services/assistant.service';

/** Human labels for the tool registry (unknown tools fall back to name). */
export const TOOL_LABELS: Record<string, string> = {
  get_low_stock: 'Low stock',
  search_inventory: 'Inventory search',
  record_sale: 'Record sale',
  record_purchase: 'Record purchase',
  record_wastage: 'Record wastage',
  create_inventory_item: 'New inventory item',
  update_inventory_item: 'Update inventory item',
  create_note: 'Create note',
  // ISP vertical
  search_subscribers: 'Find subscriber',
  list_service_plans: 'Service plans',
  list_subscriber_invoices: 'Subscriber invoices',
  list_work_orders: 'Work orders',
  list_overdue_subscribers: 'Overdue subscribers',
  list_open_tickets: 'Open tickets',
  create_subscriber: 'New subscriber',
  assign_plan: 'Assign plan',
  suspend_subscriber: 'Suspend subscriber',
  reactivate_subscriber: 'Reactivate subscriber',
  churn_subscriber: 'Churn subscriber',
  generate_subscriber_invoice: 'Generate invoice',
  record_subscriber_payment: 'Record payment',
  issue_equipment: 'Issue equipment',
  create_work_order: 'Create work order',
  start_work_order: 'Start work order',
  complete_work_order: 'Complete work order',
  create_ticket: 'Create ticket',
  resolve_ticket: 'Resolve ticket',
  // Guest house vertical
  search_guests: 'Find guest',
  list_rooms: 'Rooms',
  list_bookings: 'Bookings',
  get_arrivals_departures: 'Arrivals & departures',
  get_booking_invoice: 'Booking invoice',
  create_guest: 'New guest',
  create_room: 'New room',
  update_room: 'Update room',
  mark_room_dirty: 'Mark room dirty',
  mark_room_clean: 'Mark room clean',
  create_booking: 'New booking',
  check_in_booking: 'Check in',
  check_out_booking: 'Check out',
  add_consumption: 'Add consumption',
  generate_booking_invoice: 'Generate invoice',
  record_booking_payment: 'Record payment',
  add_invoice_line_item: 'Add invoice charge',
  // School vertical
  search_students: 'Find student',
  list_classes: 'Classes',
  list_academic_terms: 'Academic terms',
  list_fee_defaulters: 'Fee defaulters',
  get_fee_summary: 'Fee summary',
  list_fee_invoices: 'Fee invoices',
  create_student: 'New student',
  update_student: 'Update student',
  create_class: 'New class',
  update_class: 'Update class',
  generate_fee_invoices: 'Generate fee invoices',
  record_fee_payment: 'Record fee payment',
  issue_fee_invoice: 'Issue invoice',
  void_fee_invoice: 'Void invoice',
  record_supply_issue: 'Issue supplies',
  // Wholesaler vertical
  list_debtors: 'Debtors',
  list_packaging_units: 'Packaging units',
  get_top_sellers: 'Top sellers',
  record_wholesale_sale: 'Wholesale sale',
  record_bulk_sale: 'Bulk (carton) sale',
  record_credit_payment: 'Credit payment',
  create_tiered_price: 'Price tiers',
  // Restaurant vertical
  get_open_tables: 'Open tables',
  list_menu_items: 'Menu items',
  get_menu_item_recipe: 'Recipe',
  create_table_order: 'Open table order',
  add_order_item: 'Add order item',
  close_table_order: 'Close table order',
  record_recipe_consumption: 'Record dish sold',
  update_menu_price: 'Update menu price',
  // Chemist vertical
  list_expiring_batches: 'Expiring batches',
  get_drug_info: 'Medicine lookup',
  receive_stock_batch: 'Receive batch',
  record_expiry_writeoff: 'Expiry write-off',
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
  // ISP vertical
  list_overdue_subscribers: 'Who is overdue?',
  list_open_tickets: 'Show open support tickets',
  create_subscriber: 'Add a new subscriber',
  generate_subscriber_invoice: 'Generate this month\u2019s invoices',
  record_subscriber_payment: 'Record an M-Pesa payment',
  suspend_subscriber: 'Suspend a subscriber',
  issue_equipment: 'Issue a router to a subscriber',
  create_work_order: 'Schedule an installation',
  // Guest house vertical
  list_rooms: 'Which rooms are free?',
  get_arrivals_departures: 'Who arrives today?',
  create_guest: 'Add a new guest',
  create_booking: 'Book Room 3 for John',
  check_in_booking: 'Check in a guest',
  check_out_booking: 'Check out a guest',
  add_consumption: 'Add 2 sodas to Room 3',
  // School vertical
  list_fee_defaulters: 'Who has not paid fees?',
  get_fee_summary: 'Fee collection summary',
  create_student: 'Enrol a new student',
  generate_fee_invoices: 'Generate this term\u2019s invoices',
  record_fee_payment: 'Record a fee payment',
  record_supply_issue: 'Issue exercise books to Form 2',
  // Wholesaler vertical
  list_debtors: 'Who owes us money?',
  get_top_sellers: 'What are our top sellers?',
  record_wholesale_sale: 'Sold 20 kg of sugar to Ali',
  record_bulk_sale: 'Sell 50 cartons of soda to Mama Mboga',
  record_credit_payment: 'Record a credit payment',
  create_tiered_price: 'Set wholesale prices for sugar',
  // Restaurant vertical
  get_open_tables: 'Which tables are open?',
  list_menu_items: 'Show the menu',
  create_table_order: 'Open Table 5 with 2 biryani',
  close_table_order: 'Close Table 3',
  record_recipe_consumption: 'Sold 3 biryani',
  update_menu_price: 'Change the price of biryani',
  // Chemist vertical
  list_expiring_batches: 'What is expiring soon?',
  get_drug_info: 'Do we have Amoxil?',
  receive_stock_batch: 'Received 50 Amoxil batch B123 exp 12/2027',
  record_expiry_writeoff: 'Write off expired batches',
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
