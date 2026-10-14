import { ForbiddenException } from '@nestjs/common';
import { FeatureFlagService, rolloutBucket } from './feature-flag.service';

const CTX = { organizationId: 'org_1', businessType: 'DUKA' };

function build(rows: Array<Record<string, unknown>> = []) {
  const db = { featureFlag: { findMany: jest.fn(async () => rows) } };
  const service = new FeatureFlagService({ db } as never);
  return { service, db };
}

describe('rolloutBucket', () => {
  it('is deterministic and within 0-99', () => {
    const first = rolloutBucket('org_1');
    expect(first).toBe(rolloutBucket('org_1'));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(100);
  });
});

describe('FeatureFlagService', () => {
  it('enables the assistant capabilities when no flag row exists', async () => {
    const { service } = build([]);
    await expect(service.isEnabled('assistant.read', CTX)).resolves.toBe(true);
    await expect(service.isEnabled('assistant.write', CTX)).resolves.toBe(true);
    await expect(
      service.isEnabled('assistant.communicate', CTX),
    ).resolves.toBe(true);
  });

  it('keeps unknown and shadow flags denied by default', async () => {
    const { service } = build([]);
    await expect(service.isEnabled('assistant.shadow', CTX)).resolves.toBe(false);
    await expect(service.isEnabled('assistant.unknown', CTX)).resolves.toBe(
      false,
    );
  });

  it('lets an explicit disabled row turn a default-on capability off', async () => {
    const { service } = build([
      { key: 'assistant.read', scope: 'GLOBAL', enabled: false, rolloutPct: 100 },
    ]);
    await expect(service.isEnabled('assistant.read', CTX)).resolves.toBe(false);
  });

  it('allows when enabled at full rollout', async () => {
    const { service } = build([
      { key: 'assistant.read', scope: 'GLOBAL', enabled: true, rolloutPct: 100 },
    ]);
    await expect(service.isEnabled('assistant.read', CTX)).resolves.toBe(true);
  });

  it('uses the most specific scope returned first', async () => {
    const { service } = build([
      { key: 'assistant.read', scope: 'ORGANIZATION', enabled: true, rolloutPct: 100 },
      { key: 'assistant.read', scope: 'GLOBAL', enabled: false, rolloutPct: 100 },
    ]);
    await expect(service.isEnabled('assistant.read', CTX)).resolves.toBe(true);
  });

  it('treats rolloutPct 0 as off even when enabled', async () => {
    const { service } = build([
      { key: 'assistant.read', scope: 'GLOBAL', enabled: true, rolloutPct: 0 },
    ]);
    await expect(service.isEnabled('assistant.read', CTX)).resolves.toBe(false);
  });

  it('throws from assertEnabled when a default-off flag is missing', async () => {
    const { service } = build([]);
    await expect(
      service.assertEnabled('assistant.shadow', CTX),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
