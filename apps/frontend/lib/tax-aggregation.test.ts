import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ALL_LOCATIONS_LABEL,
  sumLocations,
  totalsMatchLocations,
  type AggregatableLocation,
} from './tax-aggregation.ts';

function location(
  name: string,
  overrides: Partial<AggregatableLocation> = {},
): AggregatableLocation {
  return {
    location: name,
    invoiceCount: 1,
    filed: 1,
    pending: 0,
    failed: 0,
    taxableAmount: 1000,
    taxAmount: 160,
    grossAmount: 1160,
    pendingTaxAmount: 0,
    ...overrides,
  };
}

test('sumLocations rolls multiple locations into one grand total', () => {
  const total = sumLocations([
    location('Tower A'),
    location('Tower B', { taxableAmount: 2000, taxAmount: 320, grossAmount: 2320 }),
    location('Main location', {
      filed: 0,
      pending: 1,
      taxableAmount: 0,
      taxAmount: 0,
      grossAmount: 0,
      pendingTaxAmount: 80,
    }),
  ]);

  assert.equal(total.location, ALL_LOCATIONS_LABEL);
  assert.equal(total.invoiceCount, 3);
  assert.equal(total.filed, 2);
  assert.equal(total.pending, 1);
  assert.equal(total.taxAmount, 480);
  assert.equal(total.pendingTaxAmount, 80);
});

test('totalsMatchLocations detects a wrong grand total', () => {
  const locations = [location('Tower A'), location('Tower B')];
  const correct = sumLocations(locations);

  assert.equal(totalsMatchLocations(locations, correct), true);
  assert.equal(
    totalsMatchLocations(locations, { ...correct, taxAmount: 1 }),
    false,
  );
});

test('sumLocations is zeroed for no locations', () => {
  const total = sumLocations([]);
  assert.equal(total.invoiceCount, 0);
  assert.equal(total.taxAmount, 0);
  assert.equal(total.location, ALL_LOCATIONS_LABEL);
});

test('the multi-location view is read-only (no data-entry / mutation)', () => {
  const source = readFileSync(
    join(process.cwd(), 'app', '(dashboard)', 'tax', 'aggregate', 'page.tsx'),
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
    '<form',
    'onSubmit=',
    '<input',
    '<textarea',
    '<select',
  ];

  for (const token of forbidden) {
    assert.ok(
      !source.includes(token),
      `Multi-location view must not contain "${token}"`,
    );
  }

  assert.ok(source.includes('getTaxAggregate'));
  assert.ok(source.includes('sumLocations'));
});
