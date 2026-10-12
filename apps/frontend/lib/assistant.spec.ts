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
