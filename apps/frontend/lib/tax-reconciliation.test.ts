import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  deadlineLabel,
  isDeadlineUrgent,
  summarizeAnomalies,
  taxAnomalyMeta,
} from './tax-reconciliation.ts';

test('summarizeAnomalies splits critical vs warning', () => {
  const summary = summarizeAnomalies([
    { type: 'SALE_NOT_FILED', severity: 'critical' },
    { type: 'SALE_NOT_SYNCED', severity: 'warning' },
    { type: 'FILED_AMOUNT_MISMATCH', severity: 'critical' },
  ]);

  assert.deepEqual(summary, { total: 3, critical: 2, warning: 1 });
});

test('every anomaly type has user-facing copy', () => {
  for (const type of [
    'SALE_NOT_FILED',
    'SALE_NOT_SYNCED',
    'FILED_AMOUNT_MISMATCH',
    'FILED_FOR_NON_SALE',
  ] as const) {
    assert.ok(taxAnomalyMeta(type).label.length > 0, type);
    assert.ok(taxAnomalyMeta(type).description.length > 0, type);
  }
});

test('deadline copy is honest about lateness', () => {
  assert.equal(deadlineLabel(5), 'Due in 5 days');
  assert.equal(deadlineLabel(1), 'Due in 1 day');
  assert.equal(deadlineLabel(0), 'Due today');
  assert.equal(deadlineLabel(-2), 'Overdue by 2 days');
  assert.equal(isDeadlineUrgent(7), true);
  assert.equal(isDeadlineUrgent(8), false);
});

test('the reconciliation dashboard is read-only (no data-entry / mutation)', () => {
  const source = readFileSync(
    join(process.cwd(), 'app', '(dashboard)', 'tax', 'reconciliation', 'page.tsx'),
    'utf8',
  );

  const forbidden = [
    'apiPost(',
    'apiPatch(',
    'apiPut(',
    'apiDelete(',
    'saveTaxRegistration',
    'submitTaxRegistration',
    'recordKraOutcome',
    'changePaymentMethod',
    '<form',
    'onSubmit=',
    '<input',
    '<textarea',
    '<select',
  ];

  for (const token of forbidden) {
    assert.ok(
      !source.includes(token),
      `Reconciliation dashboard must not contain "${token}"`,
    );
  }

  assert.ok(source.includes('getTaxReconciliation'));
});
