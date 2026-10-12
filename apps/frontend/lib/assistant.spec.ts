import { describe, it, expect } from 'vitest';
import {
  coerceField,
  displayValue,
  extractDiffRows,
  proposalStatusLabel,
  proposalStatusTone,
  riskLabel,
  suggestionsForTools,
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
});
