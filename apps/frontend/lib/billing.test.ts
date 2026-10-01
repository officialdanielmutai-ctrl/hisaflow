import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  additionalSeatsFrom,
  clampAdditionalSeats,
  describeInvoiceStatus,
  describePlanDirection,
  planChangeDirection,
} from './billing.ts';

test('planChangeDirection separates upgrade from downgrade', () => {
  assert.equal(planChangeDirection('SOLO', 'TEAM'), 'upgrade');
  assert.equal(planChangeDirection('TEAM', 'GROWTH'), 'upgrade');
  assert.equal(planChangeDirection('GROWTH', 'SOLO'), 'downgrade');
  assert.equal(planChangeDirection('TEAM', 'SOLO'), 'downgrade');
  assert.equal(planChangeDirection('TEAM', 'TEAM'), 'same');
});

test('describePlanDirection states immediate vs deferred behaviour', () => {
  assert.equal(
    describePlanDirection('upgrade'),
    'Takes effect immediately',
  );
  assert.equal(
    describePlanDirection('downgrade'),
    'Takes effect at your next renewal',
  );
});

test('clampAdditionalSeats never removes the tier base', () => {
  assert.equal(clampAdditionalSeats(0, -1), 0);
  assert.equal(clampAdditionalSeats(2, -1), 1);
  assert.equal(clampAdditionalSeats(2, 3), 5);
});

test('additionalSeatsFrom derives purchased seats from the allowance', () => {
  assert.equal(additionalSeatsFrom(5, 3), 2);
  assert.equal(additionalSeatsFrom(1, 3), 0);
});

test('describeInvoiceStatus maps payment attempt states to receipt tones', () => {
  assert.deepEqual(describeInvoiceStatus('SUCCESS'), {
    label: 'Paid',
    tone: 'success',
  });
  assert.equal(describeInvoiceStatus('PENDING').tone, 'warning');
  assert.equal(describeInvoiceStatus('FAILED').tone, 'danger');
  assert.equal(describeInvoiceStatus('SUCCESS').label, 'Paid');
});
