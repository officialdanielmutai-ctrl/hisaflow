import type {
  AssistantProposalStatus,
  AssistantRiskLevel,
  AssistantToolSchema,
} from '@/services/assistant.service';

export type AssistantInlineSegment = {
  kind: 'text' | 'strong' | 'code';
  text: string;
};

export type AssistantDataRow = { label: string; value: string };

export type AssistantMessageBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'bullet'; items: string[] }
  | { type: 'numbered'; items: string[] }
  | { type: 'data'; rows: AssistantDataRow[] };

const INLINE_TOKEN = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/g;

/**
 * A very small, safe Markdown-lite parser for assistant replies.
 *
 * The model is asked for natural prose, but it sometimes returns **bold**,
 * backticks or fenced blocks. Rendering those as raw text makes a shop owner's
 * answer look like source code. This parser keeps the useful emphasis and list
 * structure while dropping code fences and backticks.
 */
export function parseAssistantInline(text: string): AssistantInlineSegment[] {
  const segments: AssistantInlineSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(INLINE_TOKEN)) {
    const token = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ kind: 'text', text: text.slice(lastIndex, index) });
    }
    if (token.startsWith('**') || token.startsWith('__')) {
      segments.push({ kind: 'strong', text: token.slice(2, -2) });
    } else {
      segments.push({ kind: 'code', text: token.slice(1, -1) });
    }
    lastIndex = index + token.length;
  }
  if (lastIndex < text.length) {
    segments.push({ kind: 'text', text: text.slice(lastIndex) });
  }
  return segments.length > 0 ? segments : [{ kind: 'text', text }];
}

function flushParagraph(
  blocks: AssistantMessageBlock[],
  lines: string[],
): void {
  const text = lines.join(' ').trim();
  if (text) blocks.push({ type: 'paragraph', text });
  lines.length = 0;
}

function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : 'Value';
}

function formatPrimitive(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') {
    return new Intl.NumberFormat('en-KE', { maximumFractionDigits: 2 }).format(
      value,
    );
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function flattenData(
  value: unknown,
  prefix: string,
  rows: AssistantDataRow[],
): void {
  if (Array.isArray(value)) {
    const primitives = value.every(
      (entry) => entry === null || typeof entry !== 'object',
    );
    if (primitives) {
      rows.push({
        label: prefix || 'Items',
        value: value.map(formatPrimitive).join(', '),
      });
      return;
    }
    value.forEach((entry, index) => {
      flattenData(entry, prefix ? `${prefix} ${index + 1}` : `Item ${index + 1}`, rows);
    });
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      const label = prefix
        ? `${prefix} · ${humanizeKey(key)}`
        : humanizeKey(key);
      if (entry && typeof entry === 'object') flattenData(entry, label, rows);
      else rows.push({ label, value: formatPrimitive(entry) });
    }
    return;
  }
  rows.push({ label: prefix || 'Value', value: formatPrimitive(value) });
}

/**
 * Turn a fenced block into readable rows. Models occasionally ignore the
 * prose instruction and return JSON; showing that as a definition list is far
 * friendlier than a wall of braces. Plain text blocks stay as prose.
 */
function fencedBlock(content: string): AssistantMessageBlock | null {
  const trimmed = content.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const rows: AssistantDataRow[] = [];
      flattenData(JSON.parse(trimmed), '', rows);
      if (rows.length > 0 && rows.length <= 40) {
        return { type: 'data', rows };
      }
    } catch {
      // Not valid JSON after all; fall through to prose.
    }
  }
  return { type: 'paragraph', text: trimmed.replace(/\s+/g, ' ') };
}

/** Parse an assistant reply into paragraphs, headings, lists and data rows. */
export function parseAssistantMessage(text: string): AssistantMessageBlock[] {
  const blocks: AssistantMessageBlock[] = [];
  const paragraph: string[] = [];
  let list: { type: 'bullet' | 'numbered'; items: string[] } | null = null;
  let fence: string[] | null = null;

  const endList = () => {
    if (list && list.items.length > 0) blocks.push(list);
    list = null;
  };

  for (const rawLine of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim();

    // Fenced content is collected and re-rendered as prose/data, never as a
    // developer-looking code block.
    if (line.startsWith('```')) {
      flushParagraph(blocks, paragraph);
      endList();
      if (fence === null) {
        fence = [];
      } else {
        const block = fencedBlock(fence.join('\n'));
        if (block) blocks.push(block);
        fence = null;
      }
      continue;
    }
    if (fence !== null) {
      fence.push(rawLine);
      continue;
    }

    if (!line) {
      flushParagraph(blocks, paragraph);
      endList();
      continue;
    }

    // Horizontal rules and markdown table separators are noise.
    if (/^([-*_])\1{2,}$/.test(line)) {
      flushParagraph(blocks, paragraph);
      endList();
      continue;
    }

    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      flushParagraph(blocks, paragraph);
      endList();
      blocks.push({ type: 'heading', text: heading[1] });
      continue;
    }

    // A markdown table becomes a readable bullet list instead of raw pipes.
    const table = line.match(/^\|(.+)\|$/);
    if (table) {
      const cells = table[1]
        .split('|')
        .map((cell) => cell.trim())
        .filter(Boolean);
      if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
      flushParagraph(blocks, paragraph);
      if (!list || list.type !== 'bullet') {
        endList();
        list = { type: 'bullet', items: [] };
      }
      list.items.push(cells.join(' · '));
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph(blocks, paragraph);
      endList();
      if (quote[1]) paragraph.push(quote[1]);
      continue;
    }

    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      flushParagraph(blocks, paragraph);
      if (!list || list.type !== 'bullet') {
        endList();
        list = { type: 'bullet', items: [] };
      }
      list.items.push(bullet[1]);
      continue;
    }

    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (numbered) {
      flushParagraph(blocks, paragraph);
      if (!list || list.type !== 'numbered') {
        endList();
        list = { type: 'numbered', items: [] };
      }
      list.items.push(numbered[1]);
      continue;
    }

    if (list) endList();
    paragraph.push(line);
  }

  if (fence !== null) {
    const block = fencedBlock(fence.join('\n'));
    if (block) blocks.push(block);
  }
  flushParagraph(blocks, paragraph);
  endList();
  return blocks;
}

/** Human labels for the tool registry (unknown tools fall back to name). */
export const TOOL_LABELS: Record<string, string> = {
  get_low_stock: 'Low stock',
  search_inventory: 'Inventory search',
  list_inventory: 'Inventory list',
  get_sales_report: 'Sales report',
  analyse_catalogue: 'Catalogue advice',
  get_credit_summary: 'Credit summary',
  get_expense_report: 'Expense report',
  get_active_alerts: 'Active alerts',
  get_purchase_report: 'Purchase report',
  get_recent_transactions: 'Recent activity',
  list_notes: 'Notes & tasks',
  get_tax_summary: 'Tax status',
  list_team_members: 'Team',
  resolve_alert: 'Resolve alert',
  get_financial_breakdown: 'Financial breakdown',
  search_business_finances: 'Finance search',
  record_sale: 'Record sale',
  record_purchase: 'Record purchase',
  record_wastage: 'Record wastage',
  create_inventory_item: 'New inventory item',
  update_inventory_item: 'Update inventory item',
  adjust_stock: 'Stock correction',
  archive_inventory_item: 'Archive item',
  record_expense: 'Record expense',
  record_income: 'Record income',
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
  report_room_issue: 'Report room fault',
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
  list_inventory: 'What is in my stock?',
  get_sales_report: 'How were sales this week?',
  analyse_catalogue: 'What should I stock next?',
  get_credit_summary: 'Who owes me money?',
  get_expense_report: 'What did I spend this month?',
  get_active_alerts: 'What needs my attention?',
  get_purchase_report: 'What did I spend on stock?',
  get_recent_transactions: 'What happened today?',
  list_notes: 'What tasks are open?',
  get_tax_summary: 'Is my tax filing up to date?',
  list_team_members: 'Who works here?',
  get_financial_breakdown: 'How is my business doing financially?',
  search_business_finances: 'How much did Room 3 earn?',
  record_sale: 'Sold 3 unga',
  record_purchase: 'Received 10 sugar',
  record_wastage: '2 milk expired',
  create_inventory_item: 'Add a new item: 5 litres cooking oil',
  update_inventory_item: 'Change the price of sugar',
  adjust_stock: 'Stock count: 12 sugar left',
  record_expense: 'I paid 5000 rent',
  record_income: 'Received 2000 service fee',
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
  report_room_issue: 'Report a broken room',
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

export interface ProposalDestination {
  label: string;
  href: string;
}

/**
 * Where an executed proposal's record lives, so a card can link the user to
 * what the assistant just did instead of leaving them to guess. Tools with no
 * stable page (for example outbound SMS/email) return null.
 */
const PROPOSAL_DESTINATIONS: Record<string, ProposalDestination> = {
  create_note: { label: 'Notes', href: '/notes' },
  resolve_alert: { label: 'Alerts', href: '/alerts' },
  create_inventory_item: { label: 'Inventory', href: '/inventory' },
  update_inventory_item: { label: 'Inventory', href: '/inventory' },
  adjust_stock: { label: 'Inventory', href: '/inventory' },
  archive_inventory_item: { label: 'Inventory', href: '/inventory' },
  record_expense: { label: 'Finance', href: '/finance' },
  record_income: { label: 'Finance', href: '/finance' },
  record_sale: { label: 'Transactions', href: '/transactions' },
  record_purchase: { label: 'Transactions', href: '/transactions' },
  record_wastage: { label: 'Transactions', href: '/transactions' },
  receive_stock_batch: { label: 'Inventory', href: '/inventory' },
  record_expiry_writeoff: { label: 'Transactions', href: '/transactions' },
  // Guest house
  create_guest: { label: 'Guests', href: '/guests' },
  create_room: { label: 'Rooms', href: '/rooms' },
  update_room: { label: 'Rooms', href: '/rooms' },
  mark_room_dirty: { label: 'Rooms', href: '/rooms' },
  mark_room_clean: { label: 'Rooms', href: '/rooms' },
  report_room_issue: { label: 'Rooms', href: '/rooms' },
  create_booking: { label: 'Bookings', href: '/bookings' },
  check_in_booking: { label: 'Bookings', href: '/bookings' },
  check_out_booking: { label: 'Bookings', href: '/bookings' },
  add_consumption: { label: 'Bookings', href: '/bookings' },
  generate_booking_invoice: { label: 'Bookings', href: '/bookings' },
  record_booking_payment: { label: 'Bookings', href: '/bookings' },
  add_invoice_line_item: { label: 'Bookings', href: '/bookings' },
  // ISP
  create_subscriber: { label: 'Subscribers', href: '/subscribers' },
  assign_plan: { label: 'Subscribers', href: '/subscribers' },
  suspend_subscriber: { label: 'Subscribers', href: '/subscribers' },
  reactivate_subscriber: { label: 'Subscribers', href: '/subscribers' },
  churn_subscriber: { label: 'Subscribers', href: '/subscribers' },
  record_subscriber_payment: { label: 'Subscribers', href: '/subscribers' },
  generate_subscriber_invoice: { label: 'Subscribers', href: '/subscribers' },
  issue_equipment: { label: 'Subscribers', href: '/subscribers' },
  create_work_order: { label: 'Work orders', href: '/work-orders' },
  start_work_order: { label: 'Work orders', href: '/work-orders' },
  complete_work_order: { label: 'Work orders', href: '/work-orders' },
  create_ticket: { label: 'Tickets', href: '/tickets' },
  resolve_ticket: { label: 'Tickets', href: '/tickets' },
  // School
  create_student: { label: 'Students', href: '/students' },
  update_student: { label: 'Students', href: '/students' },
  create_class: { label: 'Classes', href: '/school-classes' },
  update_class: { label: 'Classes', href: '/school-classes' },
  record_fee_payment: { label: 'Fees', href: '/school-fees' },
  generate_fee_invoices: { label: 'Fees', href: '/school-fees' },
  issue_fee_invoice: { label: 'Fees', href: '/school-fees' },
  void_fee_invoice: { label: 'Fees', href: '/school-fees' },
  record_supply_issue: { label: 'Transactions', href: '/transactions' },
  // Restaurant
  create_table_order: { label: 'Table orders', href: '/table-orders' },
  add_order_item: { label: 'Table orders', href: '/table-orders' },
  close_table_order: { label: 'Table orders', href: '/table-orders' },
  record_recipe_consumption: { label: 'Transactions', href: '/transactions' },
  update_menu_price: { label: 'Inventory', href: '/inventory' },
  // Wholesaler
  record_wholesale_sale: { label: 'Transactions', href: '/transactions' },
  record_bulk_sale: { label: 'Transactions', href: '/transactions' },
  record_credit_payment: { label: 'Finance', href: '/finance' },
  create_tiered_price: { label: 'Inventory', href: '/inventory' },
};

export function proposalDestination(tool: string): ProposalDestination | null {
  return PROPOSAL_DESTINATIONS[tool] ?? null;
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

/** True when a proposal should render as the reviewable note panel. */
export function isNoteProposal(proposal: { tool: string }): boolean {
  return proposal.tool === 'create_note';
}

export const NOTE_IMPORTANCE = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type NoteImportance = (typeof NOTE_IMPORTANCE)[number];

/** Editable note draft as it appears in the panel. */
export interface NoteDraft {
  title: string;
  content: string;
  importance: NoteImportance;
  /** `datetime-local` value (local time), or '' when unset. */
  dueDate: string;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** ISO date (from the proposal) → local `datetime-local` input value. */
export function toDateTimeLocal(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Local `datetime-local` input value → ISO string, or undefined. */
export function fromDateTimeLocal(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** Prefill the note panel from a `create_note` proposal's validated args. */
export function noteDraftFromProposal(proposal: {
  args: Record<string, unknown>;
}): NoteDraft {
  const args = proposal.args ?? {};
  const rawImportance = String(args.importance ?? 'MEDIUM').toUpperCase();
  const importance = (NOTE_IMPORTANCE as readonly string[]).includes(
    rawImportance,
  )
    ? (rawImportance as NoteImportance)
    : 'MEDIUM';
  return {
    title: typeof args.title === 'string' ? args.title : '',
    content: typeof args.content === 'string' ? args.content : '',
    importance,
    dueDate: toDateTimeLocal(args.dueDate),
  };
}

/** Panel draft → proposal args (empty optional fields are omitted). */
export function noteArgsFromDraft(draft: NoteDraft): Record<string, unknown> {
  return {
    title: draft.title.trim(),
    content: draft.content.trim() || undefined,
    importance: draft.importance,
    dueDate: fromDateTimeLocal(draft.dueDate),
  };
}

/** True when the panel's next args are unchanged, so no new version is needed. */
export function noteArgsEqual(
  proposalArgs: Record<string, unknown>,
  nextArgs: Record<string, unknown>,
): boolean {
  const norm = (value: unknown) =>
    value === undefined || value === null ? '' : String(value).trim();
  return (
    norm(proposalArgs.title) === norm(nextArgs.title) &&
    norm(proposalArgs.content) === norm(nextArgs.content) &&
    norm(proposalArgs.importance ?? 'MEDIUM') ===
      norm(nextArgs.importance ?? 'MEDIUM') &&
    norm(proposalArgs.dueDate) === norm(nextArgs.dueDate)
  );
}
