import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ETIMS_ONBOARDING_STEPS,
  canFileLive,
  isTaxPending,
  nextTaxStep,
  taxScreenState,
  taxStatusMeta,
} from './tax.ts';

test('canFileLive is true only for PRODUCTION_ACTIVE', () => {
  assert.equal(canFileLive('PRODUCTION_ACTIVE'), true);
  for (const status of [
    'NOT_REGISTERED',
    'PIN_CAPTURED',
    'PENDING_KRA_APPROVAL',
    'SANDBOX_ACTIVE',
    'PENDING_PRODUCTION',
    'REJECTED',
    'SUSPENDED',
  ] as const) {
    assert.equal(canFileLive(status), false, `${status} must not file live`);
  }
});

test('pending states read as pending, not active', () => {
  assert.equal(isTaxPending('PENDING_KRA_APPROVAL'), true);
  assert.equal(isTaxPending('PENDING_PRODUCTION'), true);
  assert.equal(isTaxPending('SANDBOX_ACTIVE'), true);
  assert.notEqual(taxStatusMeta('PENDING_KRA_APPROVAL').tone, 'active');
  assert.notEqual(taxStatusMeta('SANDBOX_ACTIVE').tone, 'active');
});

test('production and captured states have the right tones', () => {
  assert.equal(taxStatusMeta('PRODUCTION_ACTIVE').tone, 'active');
  assert.equal(taxStatusMeta('PIN_CAPTURED').tone, 'neutral');
  assert.equal(taxStatusMeta('REJECTED').tone, 'danger');
});

test('every state has a non-empty label and next step', () => {
  for (const status of [
    'NOT_REGISTERED',
    'PIN_CAPTURED',
    'PENDING_KRA_APPROVAL',
    'SANDBOX_ACTIVE',
    'PENDING_PRODUCTION',
    'PRODUCTION_ACTIVE',
    'REJECTED',
    'SUSPENDED',
  ] as const) {
    assert.ok(taxStatusMeta(status).label.length > 0, status);
    assert.ok(nextTaxStep(status).length > 0, status);
  }
});

test('owner can submit only after a PIN and before approval', () => {
  const captured = taxScreenState({
    status: 'PIN_CAPTURED',
    registered: true,
    submittedAt: null,
    isOwner: true,
  });
  assert.equal(captured.canSubmit, true);
  assert.equal(captured.canRecordOutcome, false);
  assert.equal(captured.liveFiling, false);

  const pending = taxScreenState({
    status: 'PENDING_KRA_APPROVAL',
    registered: true,
    submittedAt: '2026-09-30T00:00:00.000Z',
    isOwner: true,
  });
  assert.equal(pending.canSubmit, false);
  assert.equal(pending.canRecordOutcome, true);
  assert.equal(pending.pending, true);
  assert.equal(pending.liveFiling, false);
});

test('no write controls for non-owners, and no live filing while pending', () => {
  const staff = taxScreenState({
    status: 'PENDING_KRA_APPROVAL',
    registered: true,
    submittedAt: '2026-09-30T00:00:00.000Z',
    isOwner: false,
  });
  assert.equal(staff.canEditPin, false);
  assert.equal(staff.canSubmit, false);
  assert.equal(staff.canRecordOutcome, false);
  assert.equal(staff.liveFiling, false);
});

test('production active turns live filing on and stops outcome recording', () => {
  const state = taxScreenState({
    status: 'PRODUCTION_ACTIVE',
    registered: true,
    submittedAt: '2026-09-30T00:00:00.000Z',
    isOwner: true,
  });
  assert.equal(state.liveFiling, true);
  assert.equal(state.canRecordOutcome, false);
  assert.equal(state.pending, false);
});

test('a rejected registration can be resubmitted', () => {
  const state = taxScreenState({
    status: 'REJECTED',
    registered: true,
    submittedAt: '2026-09-30T00:00:00.000Z',
    isOwner: true,
  });
  assert.equal(state.canSubmit, true);
});

test('onboarding explainer states that pending is expected and KRA-side', () => {
  const text = ETIMS_ONBOARDING_STEPS.map(
    (step) => `${step.title} ${step.description}`,
  ).join(' ');
  assert.match(text, /Pending KRA approval/i);
  assert.match(text, /outside HisaFlow/i);
  assert.ok(ETIMS_ONBOARDING_STEPS.length >= 5);
});
