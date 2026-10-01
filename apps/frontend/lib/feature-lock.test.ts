import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePaywallUrl, resolveFeatureLock } from './feature-lock.ts';
import { resolvePaywallContext } from './paywall-context.ts';

test('resolveFeatureLock ignores bodies that are not a tier/seat gate', () => {
  assert.equal(resolveFeatureLock(null), null);
  assert.equal(resolveFeatureLock({}), null);
  assert.equal(resolveFeatureLock({ message: 'Not a gate' }), null);
});

test('resolveFeatureLock reads the backend gate payload', () => {
  const lock = resolveFeatureLock({
    statusCode: 403,
    error: 'Feature Locked',
    reason: 'seat_limit',
    feature: 'staff',
    requiredTier: 'TEAM',
    message: 'Your plan does not include another staff seat.',
    paywallUrl: '/paywall?reason=seat_limit&feature=staff',
  });

  assert.ok(lock);
  assert.equal(lock!.paywallUrl, '/paywall?reason=seat_limit&feature=staff');
  assert.equal(lock!.feature, 'staff');
  assert.equal(lock!.reason, 'seat_limit');
  assert.equal(lock!.requiredTier, 'TEAM');
});

/**
 * The Phase D "Done when": a Solo org adding a staff account must land on a
 * paywall that explains *that* limit, with the triggering context preserved
 * from the backend gate all the way to the rendered message.
 */
test('end-to-end: blocked "add staff" lands on the staff-specific paywall', () => {
  // Exactly what the backend's FeatureLockedException serializes to.
  const body = {
    statusCode: 403,
    error: 'Feature Locked',
    reason: 'seat_limit',
    feature: 'staff',
    requiredTier: 'TEAM',
    currentTier: 'SOLO',
    message:
      'Your plan does not include another staff seat. Upgrade to Team to add staff.',
    paywallUrl: '/paywall?reason=seat_limit&feature=staff',
  };

  // 1. API client recognizes the gate and routes to paywallUrl.
  const lock = resolveFeatureLock(body);
  assert.ok(lock, 'the 403 must be recognized as a feature lock');

  // 2. Paywall reads the URL back and resolves context-specific messaging.
  const { feature, reason } = parsePaywallUrl(lock!.paywallUrl);
  const context = resolvePaywallContext({ feature, reason });

  assert.ok(context, 'the paywall must render specific, not generic, messaging');
  assert.match(context!.title, /staff/i);
  assert.match(context!.body, /Team/);
});

test('end-to-end: blocked second ISP router lands on the Growth multi-location paywall', () => {
  const body = {
    reason: 'feature_lock',
    feature: 'isp-routers',
    requiredTier: 'GROWTH',
    paywallUrl: '/paywall?reason=feature_lock&feature=isp-routers',
    message: 'Multiple locations are a Growth feature.',
  };

  const lock = resolveFeatureLock(body);
  assert.ok(lock);
  const { feature, reason } = parsePaywallUrl(lock!.paywallUrl);
  const context = resolvePaywallContext({ feature, reason });

  assert.ok(context);
  assert.match(context!.title, /another location/i);
  assert.match(context!.body, /Growth/);
});
