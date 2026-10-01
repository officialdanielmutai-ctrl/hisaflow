import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePaywallContext } from './paywall-context.ts';

test('returns null when there is no blocked-action context', () => {
  assert.equal(resolvePaywallContext({}), null);
});

test('maps known feature keys to specific messages', () => {
  assert.match(resolvePaywallContext({ feature: 'staff' })!.title, /staff/i);
  assert.match(
    resolvePaywallContext({ feature: 'isp-routers' })!.title,
    /location/i,
  );
  assert.match(
    resolvePaywallContext({ feature: 'forecasting' })!.title,
    /forecasting/i,
  );
});

test('falls back on the seat_limit reason when no feature key is supplied', () => {
  const context = resolvePaywallContext({ reason: 'seat_limit' });
  assert.ok(context);
  assert.match(context!.title, /staff/i);
  assert.match(context!.body, /seats/i);
});

test('uses a generic upgrade message for an unknown context', () => {
  const context = resolvePaywallContext({ reason: 'feature_lock' });
  assert.ok(context);
  assert.match(context!.body, /higher tier/i);
});
