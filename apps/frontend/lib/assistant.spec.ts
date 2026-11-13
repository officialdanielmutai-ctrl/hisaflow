import { describe, it, expect } from 'vitest';
import {
  coerceField,
  displayValue,
  extractDiffRows,
  fromDateTimeLocal,
  isNoteProposal,
  noteArgsEqual,
  noteArgsFromDraft,
  noteDraftFromProposal,
  parseAssistantInline,
  parseAssistantMessage,
  proposalDestination,
  proposalStatusLabel,
  proposalStatusTone,
  riskLabel,
  suggestionsForTools,
  toDateTimeLocal,
  toolLabel,
} from './assistant';
import type { AssistantToolSchema } from '@/services/assistant.service';

function tool(name: string): AssistantToolSchema {
  return { name, description: '', parameters: {} };
}

describe('assistant helpers', () => {
  it('generates suggestions only from the tools the org has', () => {
    const suggestions = suggestionsForTools([
      tool('record_sale'),
      tool('get_low_stock'),
      tool('record_wastage'),
    ]);
    expect(suggestions).toEqual([
      'Sold 3 unga',
      'What is low on stock?',
      '2 milk expired',
    ]);
  });

  it('caps the suggestion list', () => {
    expect(
      suggestionsForTools([tool('record_sale'), tool('record_purchase')], 1),
    ).toHaveLength(1);
  });

  it('falls back to a humanised tool name', () => {
    expect(toolLabel('some_new_tool')).toBe('some new tool');
  });

  it('generates ISP suggestions from the ISP tool set only', () => {
    const suggestions = suggestionsForTools([
      tool('list_overdue_subscribers'),
      tool('create_subscriber'),
      tool('record_subscriber_payment'),
      tool('suspend_subscriber'),
    ]);
    expect(suggestions).toEqual([
      'Who is overdue?',
      'Add a new subscriber',
      'Record an M-Pesa payment',
      'Suspend a subscriber',
    ]);
  });

  it('labels ISP tools', () => {
    expect(toolLabel('generate_subscriber_invoice')).toBe('Generate invoice');
    expect(toolLabel('issue_equipment')).toBe('Issue equipment');
  });

  it('generates guest-house suggestions from the guest-house tool set only', () => {
    const suggestions = suggestionsForTools([
      tool('list_rooms'),
      tool('get_arrivals_departures'),
      tool('create_guest'),
      tool('create_booking'),
    ]);
    expect(suggestions).toEqual([
      'Which rooms are free?',
      'Who arrives today?',
      'Add a new guest',
      'Book Room 3 for John',
    ]);
  });

  it('labels guest-house tools', () => {
    expect(toolLabel('check_in_booking')).toBe('Check in');
    expect(toolLabel('add_consumption')).toBe('Add consumption');
  });

  it('generates school suggestions from the school tool set only', () => {
    const suggestions = suggestionsForTools([
      tool('list_fee_defaulters'),
      tool('get_fee_summary'),
      tool('create_student'),
      tool('generate_fee_invoices'),
    ]);
    expect(suggestions).toEqual([
      'Who has not paid fees?',
      'Fee collection summary',
      'Enrol a new student',
      'Generate this term\u2019s invoices',
    ]);
  });

  it('labels school tools', () => {
    expect(toolLabel('record_fee_payment')).toBe('Record fee payment');
    expect(toolLabel('record_supply_issue')).toBe('Issue supplies');
  });

  it('generates wholesaler suggestions from the wholesaler tool set only', () => {
    const suggestions = suggestionsForTools([
      tool('list_debtors'),
      tool('get_top_sellers'),
      tool('record_wholesale_sale'),
      tool('record_bulk_sale'),
    ]);
    expect(suggestions).toEqual([
      'Who owes us money?',
      'What are our top sellers?',
      'Sold 20 kg of sugar to Ali',
      'Sell 50 cartons of soda to Mama Mboga',
    ]);
  });

  it('labels wholesaler tools', () => {
    expect(toolLabel('record_credit_payment')).toBe('Credit payment');
    expect(toolLabel('create_tiered_price')).toBe('Price tiers');
  });

  it('generates restaurant suggestions from the restaurant tool set only', () => {
    const suggestions = suggestionsForTools([
      tool('get_open_tables'),
      tool('list_menu_items'),
      tool('create_table_order'),
      tool('close_table_order'),
    ]);
    expect(suggestions).toEqual([
      'Which tables are open?',
      'Show the menu',
      'Open Table 5 with 2 biryani',
      'Close Table 3',
    ]);
  });

  it('labels restaurant tools', () => {
    expect(toolLabel('record_recipe_consumption')).toBe('Record dish sold');
    expect(toolLabel('update_menu_price')).toBe('Update menu price');
  });

  it('generates chemist suggestions from the chemist tool set only', () => {
    const suggestions = suggestionsForTools([
      tool('list_expiring_batches'),
      tool('get_drug_info'),
      tool('receive_stock_batch'),
      tool('record_expiry_writeoff'),
    ]);
    expect(suggestions).toEqual([
      'What is expiring soon?',
      'Do we have Amoxil?',
      'Received 50 Amoxil batch B123 exp 12/2027',
      'Write off expired batches',
    ]);
  });

  it('labels chemist tools', () => {
    expect(toolLabel('receive_stock_batch')).toBe('Receive batch');
    expect(toolLabel('record_expiry_writeoff')).toBe('Expiry write-off');
  });

  it('extracts diff rows from the stock-transaction shape', () => {
    const rows = extractDiffRows({
      item: 'Maize flour',
      quantity: { before: 20, after: 17 },
    });
    expect(rows).toEqual([{ field: 'quantity', before: '20', after: '17' }]);
  });

  it('extracts diff rows from the before/after shape', () => {
    const rows = extractDiffRows({ before: null, after: { title: 'Restock' } });
    expect(rows).toEqual([{ field: 'title', before: '—', after: 'Restock' }]);
  });

  it('renders status labels and tones', () => {
    expect(proposalStatusLabel('PROPOSED')).toBe('Proposed');
    expect(proposalStatusTone('EXECUTED')).toContain('emerald');
    expect(proposalStatusTone('FAILED')).toContain('red');
  });

  it('labels risk levels', () => {
    expect(riskLabel('high')).toBe('High risk');
    expect(riskLabel('medium')).toBe('Medium risk');
    expect(riskLabel('low')).toBe('Low risk');
  });

  it('preserves primitive types when coercing edits', () => {
    expect(coerceField('5', 3)).toBe(5);
    expect(coerceField('true', false)).toBe(true);
    expect(coerceField('Sugar', 'Salt')).toBe('Sugar');
    expect(displayValue(1200)).toBe('1,200');
    expect(displayValue(null)).toBe('—');
  });

  it('labels and suggests the inventory list tool', () => {
    expect(toolLabel('list_inventory')).toBe('Inventory list');
    expect(suggestionsForTools([tool('list_inventory')])).toEqual([
      'What is in my stock?',
    ]);
  });

  it('labels the new stock and finance write tools', () => {
    expect(toolLabel('adjust_stock')).toBe('Stock correction');
    expect(toolLabel('archive_inventory_item')).toBe('Archive item');
    expect(toolLabel('record_expense')).toBe('Record expense');
    expect(toolLabel('record_income')).toBe('Record income');
  });

  it('labels and suggests the reporting and advice tools', () => {
    expect(toolLabel('get_sales_report')).toBe('Sales report');
    expect(toolLabel('get_purchase_report')).toBe('Purchase report');
    expect(toolLabel('get_recent_transactions')).toBe('Recent activity');
    expect(toolLabel('list_notes')).toBe('Notes & tasks');
    expect(toolLabel('get_tax_summary')).toBe('Tax status');
    expect(toolLabel('list_team_members')).toBe('Team');
    expect(toolLabel('resolve_alert')).toBe('Resolve alert');
    expect(
      suggestionsForTools([
        tool('get_sales_report'),
        tool('analyse_catalogue'),
        tool('get_credit_summary'),
        tool('get_active_alerts'),
      ]),
    ).toEqual([
      'How were sales this week?',
      'What should I stock next?',
      'Who owes me money?',
      'What needs my attention?',
    ]);
  });
});

describe('proposalDestination', () => {
  it('links executed proposals to the section where the record lives', () => {
    expect(proposalDestination('create_note')).toEqual({
      label: 'Notes',
      href: '/notes',
    });
    expect(proposalDestination('create_booking')).toEqual({
      label: 'Bookings',
      href: '/bookings',
    });
    expect(proposalDestination('create_subscriber')).toEqual({
      label: 'Subscribers',
      href: '/subscribers',
    });
    expect(proposalDestination('record_sale')).toEqual({
      label: 'Transactions',
      href: '/transactions',
    });
    expect(proposalDestination('resolve_alert')).toEqual({
      label: 'Alerts',
      href: '/alerts',
    });
    expect(proposalDestination('record_expense')).toEqual({
      label: 'Finance',
      href: '/finance',
    });
    expect(proposalDestination('adjust_stock')).toEqual({
      label: 'Inventory',
      href: '/inventory',
    });
  });

  it('returns null for tools with no stable page', () => {
    expect(proposalDestination('send_sms')).toBeNull();
    expect(proposalDestination('send_email')).toBeNull();
    expect(proposalDestination('log_unsupported_intent')).toBeNull();
    expect(proposalDestination('not_a_tool')).toBeNull();
  });
});

describe('note panel helpers', () => {
  it('identifies only the create_note proposal', () => {
    expect(isNoteProposal({ tool: 'create_note' })).toBe(true);
    expect(isNoteProposal({ tool: 'record_sale' })).toBe(false);
  });

  it('round-trips a local datetime value', () => {
    const local = '2026-10-20T09:30';
    const iso = fromDateTimeLocal(local);
    expect(iso).toBeTruthy();
    expect(toDateTimeLocal(iso)).toBe(local);
  });

  it('prefills the note panel from a body-only proposal', () => {
    const draft = noteDraftFromProposal({
      args: { content: 'Pay rent\nBefore Friday', importance: 'HIGH' },
    });
    expect(draft).toMatchObject({
      title: '',
      content: 'Pay rent\nBefore Friday',
      importance: 'HIGH',
      dueDate: '',
    });
  });

  it('omits empty optional fields when building proposal args', () => {
    expect(
      noteArgsFromDraft({
        title: '  Restock  ',
        content: '   ',
        importance: 'MEDIUM',
        dueDate: '',
      }),
    ).toEqual({
      title: 'Restock',
      content: undefined,
      importance: 'MEDIUM',
      dueDate: undefined,
    });
  });

  it('detects whether the panel draft changed', () => {
    const original = {
      title: 'Restock',
      content: 'Order more',
      importance: 'MEDIUM',
    };
    expect(
      noteArgsEqual(original, {
        title: 'Restock',
        content: 'Order more',
        importance: 'MEDIUM',
        dueDate: undefined,
      }),
    ).toBe(true);
    expect(
      noteArgsEqual(original, {
        title: 'Restock',
        content: 'Order more',
        importance: 'HIGH',
      }),
    ).toBe(false);
  });
});

describe('assistant message rendering helpers', () => {
  it('turns markdown into paragraphs, bullets and headings', () => {
    const blocks = parseAssistantMessage(
      `**Sales were up.**

- Sold 3 unga
- Sold 2 sugar

### Next step
Restock unga.`,
    );
    expect(blocks).toEqual([
      { type: 'paragraph', text: '**Sales were up.**' },
      { type: 'bullet', items: ['Sold 3 unga', 'Sold 2 sugar'] },
      { type: 'heading', text: 'Next step' },
      { type: 'paragraph', text: 'Restock unga.' },
    ]);
  });

  it('turns a JSON code fence into readable labelled rows', () => {
    const blocks = parseAssistantMessage(`\`\`\`json
{ "revenue": 1200, "items": ["Sugar", "Rice"] }
\`\`\``);
    expect(blocks).toEqual([
      {
        type: 'data',
        rows: [
          { label: 'Revenue', value: '1,200' },
          { label: 'Items', value: 'Sugar, Rice' },
        ],
      },
    ]);
  });

  it('keeps a non-JSON code fence as natural prose', () => {
    const blocks = parseAssistantMessage(`\`\`\`
Revenue was up this week.
\`\`\``);
    expect(blocks).toEqual([
      { type: 'paragraph', text: 'Revenue was up this week.' },
    ]);
  });

  it('turns a markdown table into readable bullets', () => {
    const blocks = parseAssistantMessage(
      '| Item | Sales |\n| --- | --- |\n| Sugar | 850 |',
    );
    expect(blocks).toEqual([
      { type: 'bullet', items: ['Item · Sales', 'Sugar · 850'] },
    ]);
  });

  it('ignores horizontal rules and blockquote markers', () => {
    const blocks = parseAssistantMessage('---\n> Good news.\n\nNext step.');
    expect(blocks).toEqual([
      { type: 'paragraph', text: 'Good news.' },
      { type: 'paragraph', text: 'Next step.' },
    ]);
  });

  it('parses strong and inline-code segments without leaving backticks', () => {
    const segments = parseAssistantInline('Sell **unga** at `KES 120`.');
    expect(segments).toEqual([
      { kind: 'text', text: 'Sell ' },
      { kind: 'strong', text: 'unga' },
      { kind: 'text', text: ' at ' },
      { kind: 'code', text: 'KES 120' },
      { kind: 'text', text: '.' },
    ]);
  });
});
