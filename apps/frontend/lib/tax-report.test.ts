import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TAX_TAB_READ_ONLY_NOTE,
  summarizeTaxReport,
  taxFilingStatusMeta,
  taxPeriod,
} from './tax-report.ts';

test('summarizeTaxReport splits filed vs pending vs failed', () => {
  const summary = summarizeTaxReport([
    { status: 'SYNCED', netAmount: 1000, taxAmount: 160, grossAmount: 1160 },
    { status: 'SYNCED', netAmount: 1000, taxAmount: 160, grossAmount: 1160 },
    { status: 'PENDING', netAmount: 2000, taxAmount: 320, grossAmount: 2320 },
    { status: 'FAILED', netAmount: 500, taxAmount: 80, grossAmount: 580 },
  ]);

  assert.equal(summary.filed, 2);
  assert.equal(summary.pending, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.taxableAmount, 2000);
  assert.equal(summary.taxAmount, 320);
  assert.equal(summary.grossAmount, 2320);
  assert.equal(summary.pendingTaxAmount, 320);
});

test('filing status reads honestly (filed / pending / needs attention)', () => {
  assert.equal(taxFilingStatusMeta('SYNCED').label, 'Filed');
  assert.equal(taxFilingStatusMeta('PENDING').tone, 'pending');
  assert.equal(taxFilingStatusMeta('FAILED').tone, 'danger');
  assert.match(taxFilingStatusMeta('PENDING').description, /waiting to reach KRA/i);
});

test('taxPeriod returns calendar-month bounds with a readable label', () => {
  const current = taxPeriod(0, new Date('2026-09-15T12:00:00.000Z'));
  assert.equal(current.from, '2026-09-01T00:00:00.000Z');
  assert.equal(current.to, '2026-10-01T00:00:00.000Z');
  assert.equal(current.label, 'September 2026');

  const previous = taxPeriod(-1, new Date('2026-09-15T12:00:00.000Z'));
  assert.equal(previous.from, '2026-08-01T00:00:00.000Z');
  assert.equal(previous.label, 'August 2026');
});

test('the Tax tab is strictly read-only (no data-entry / mutation path)', () => {
  const source = readFileSync(
    join(process.cwd(), 'app', '(dashboard)', 'tax', 'page.tsx'),
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
      `Tax tab must not contain "${token}" — it would be a data-entry path`,
    );
  }

  // It must still read the report, and it should say it is read-only.
  assert.ok(source.includes('getTaxReport'));
  assert.ok(source.includes('TAX_TAB_READ_ONLY_NOTE'));
});

test('the read-only note is explicit for the user', () => {
  assert.match(TAX_TAB_READ_ONLY_NOTE, /read-only/i);
  assert.match(TAX_TAB_READ_ONLY_NOTE, /automatically/i);
});
