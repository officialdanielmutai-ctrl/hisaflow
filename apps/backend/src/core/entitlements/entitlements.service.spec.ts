import {
  HisaflowPlanTier,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma.service';
import { FeatureLockedException } from './feature-locked.exception';
import { TierFeature } from './entitlements.constant';
import { EntitlementsService } from './entitlements.service';

interface SubSeed {
  tier: HisaflowPlanTier;
  status?: SubscriptionStatus;
  seatAllowance?: number;
  perSeatOverageKes?: number | null;
}

function createPrismaMock(seed: {
  subscription?: SubSeed | null;
  seatCount?: number;
}) {
  const subscription = seed.subscription
    ? {
        id: 'sub_1',
        organizationId: 'org_1',
        planId: 'plan_1',
        seatCount: seed.seatCount ?? 1,
        seatAllowance: seed.subscription.seatAllowance ?? 1,
        status: seed.subscription.status ?? SubscriptionStatus.ACTIVE,
        paymentMethod: 'MPESA',
        plan: {
          id: 'plan_1',
          tier: seed.subscription.tier,
          perSeatOverageKes: seed.subscription.perSeatOverageKes ?? null,
        },
      }
    : null;

  const updateMany = jest.fn(async () => ({ count: subscription ? 1 : 0 }));
  const count = jest.fn(async () => seed.seatCount ?? 0);

  const mock = {
    db: {
      subscription: {
        findUnique: async () => subscription,
        updateMany,
      },
      orgMembership: { count },
    },
  };

  return {
    mock: mock as unknown as PrismaService,
    updateMany,
    count,
  };
}

function build(seed: Parameters<typeof createPrismaMock>[0]) {
  const prisma = createPrismaMock(seed);
  return { prisma, service: new EntitlementsService(prisma.mock) };
}

describe('EntitlementsService (Phase D)', () => {
  describe('resolve', () => {
    it('treats a no-subscription org as the defaulted Team trial', async () => {
      const { service } = build({ subscription: null, seatCount: 1 });

      const entitlements = await service.resolve('org_1');

      expect(entitlements.tier).toBe(HisaflowPlanTier.TEAM);
      expect(entitlements.hasSubscription).toBe(false);
      expect(entitlements.seatAllowance).toBe(3);
      expect(entitlements.canAutoBillSeats).toBe(false);
      expect(entitlements.isActive).toBe(true);
    });

    it('resolves a paid Team subscription and marks it auto-billable', async () => {
      const { service } = build({
        subscription: {
          tier: HisaflowPlanTier.TEAM,
          seatAllowance: 3,
        },
        seatCount: 3,
      });

      const entitlements = await service.resolve('org_1');

      expect(entitlements.tier).toBe(HisaflowPlanTier.TEAM);
      expect(entitlements.seatAllowance).toBe(3);
      expect(entitlements.canAutoBillSeats).toBe(true);
    });
  });

  describe('assertFeatures (Section 1A floor/depth)', () => {
    it('allows floor features on Solo', async () => {
      const { service } = build({
        subscription: { tier: HisaflowPlanTier.SOLO, seatAllowance: 1 },
      });

      await expect(
        service.assertFeatures('org_1', [TierFeature.TaxFiling]),
      ).resolves.toBeDefined();
    });

    it('locks a Team-depth feature on Solo and returns paywall context', async () => {
      const { service } = build({
        subscription: { tier: HisaflowPlanTier.SOLO, seatAllowance: 1 },
      });

      await expect(
        service.assertFeatures('org_1', [TierFeature.RolePermissions]),
      ).rejects.toBeInstanceOf(FeatureLockedException);

      try {
        await service.assertFeatures('org_1', [TierFeature.RolePermissions]);
        fail('expected FeatureLockedException');
      } catch (err) {
        const body = (err as FeatureLockedException).getResponse() as Record<
          string,
          unknown
        >;
        expect(body.reason).toBe('feature_lock');
        expect(body.requiredTier).toBe('TEAM');
        expect(body.feature).toBe('staff');
        expect(body.paywallUrl).toBe(
          '/paywall?reason=feature_lock&feature=staff',
        );
      }
    });

    it('allows Team-depth features on Team but locks Growth features', async () => {
      const { service } = build({
        subscription: { tier: HisaflowPlanTier.TEAM, seatAllowance: 3 },
      });

      await expect(
        service.assertFeatures('org_1', [TierFeature.RolePermissions]),
      ).resolves.toBeDefined();

      await expect(
        service.assertFeatures('org_1', [TierFeature.MultiLocation]),
      ).rejects.toBeInstanceOf(FeatureLockedException);
    });

    it('allows Growth features on Growth', async () => {
      const { service } = build({
        subscription: { tier: HisaflowPlanTier.GROWTH, seatAllowance: 100 },
      });

      await expect(
        service.assertFeatures('org_1', [TierFeature.MultiLocation]),
      ).resolves.toBeDefined();
    });

    it('locks everything on a suspended subscription', async () => {
      const { service } = build({
        subscription: {
          tier: HisaflowPlanTier.GROWTH,
          status: SubscriptionStatus.SUSPENDED,
          seatAllowance: 100,
        },
      });

      await expect(
        service.assertFeatures('org_1', [TierFeature.TaxFiling]),
      ).rejects.toBeInstanceOf(FeatureLockedException);
    });
  });

  describe('seat policy (Section 7 item 4)', () => {
    it('blocks a second seat on Solo with a Team upgrade context', async () => {
      const { service } = build({
        subscription: { tier: HisaflowPlanTier.SOLO, seatAllowance: 1 },
        seatCount: 1,
      });

      await expect(service.assertSeatAvailable('org_1')).rejects.toBeInstanceOf(
        FeatureLockedException,
      );

      try {
        await service.assertSeatAvailable('org_1');
        fail('expected FeatureLockedException');
      } catch (err) {
        const body = (err as FeatureLockedException).getResponse() as Record<
          string,
          unknown
        >;
        expect(body.reason).toBe('seat_limit');
        expect(body.feature).toBe('staff');
        expect(body.requiredTier).toBe('TEAM');
        expect(body.paywallUrl).toBe(
          '/paywall?reason=seat_limit&feature=staff',
        );
      }
    });

    it('never blocks a Team org over its allowance, and reports the overage', async () => {
      const { service } = build({
        subscription: { tier: HisaflowPlanTier.TEAM, seatAllowance: 3 },
        seatCount: 3,
      });

      const decision = await service.assertSeatAvailable('org_1');

      expect(decision.allowed).toBe(true);
      expect(decision.autoBilled).toBe(true);
      expect(decision.overage).toBe(1);
    });

    it('does not bill while under the allowance', async () => {
      const { service } = build({
        subscription: { tier: HisaflowPlanTier.TEAM, seatAllowance: 3 },
        seatCount: 2,
      });

      const decision = await service.assertSeatAvailable('org_1');

      expect(decision.autoBilled).toBe(false);
      expect(decision.overage).toBe(0);
    });

    it('blocks an unbilled trial over its seats (nothing to auto-bill)', async () => {
      const { service } = build({ subscription: null, seatCount: 3 });

      await expect(service.assertSeatAvailable('org_1')).rejects.toBeInstanceOf(
        FeatureLockedException,
      );
    });

    it('syncs the stored seat count from the real membership rows', async () => {
      const { service, prisma } = build({
        subscription: { tier: HisaflowPlanTier.TEAM, seatAllowance: 3 },
        seatCount: 4,
      });

      const count = await service.syncSeatCount('org_1');

      expect(count).toBe(4);
      expect(prisma.updateMany).toHaveBeenCalledWith({
        where: { organizationId: 'org_1' },
        data: { seatCount: 4 },
      });
    });
  });

  describe('multi-location (Growth depth)', () => {
    it('allows the first location on any tier', async () => {
      const { service } = build({
        subscription: { tier: HisaflowPlanTier.SOLO, seatAllowance: 1 },
      });

      await expect(
        service.assertMultiLocationAllowed('org_1', 0, 'isp-routers'),
      ).resolves.toBeUndefined();
    });

    it('locks a second location below Growth with the isp-routers context', async () => {
      const { service } = build({
        subscription: { tier: HisaflowPlanTier.TEAM, seatAllowance: 3 },
      });

      try {
        await service.assertMultiLocationAllowed('org_1', 1, 'isp-routers');
        fail('expected FeatureLockedException');
      } catch (err) {
        const body = (err as FeatureLockedException).getResponse() as Record<
          string,
          unknown
        >;
        expect(body.feature).toBe('isp-routers');
        expect(body.requiredTier).toBe('GROWTH');
      }
    });

    it('allows a second location on Growth', async () => {
      const { service } = build({
        subscription: { tier: HisaflowPlanTier.GROWTH, seatAllowance: 100 },
      });

      await expect(
        service.assertMultiLocationAllowed('org_1', 1, 'isp-routers'),
      ).resolves.toBeUndefined();
    });
  });

  describe('hasFeature (non-throwing gate for background jobs)', () => {
    it('is false for Team-depth reconciliation on Solo', async () => {
      const { service } = build({
        subscription: { tier: HisaflowPlanTier.SOLO, seatAllowance: 1 },
      });

      await expect(
        service.hasFeature('org_1', TierFeature.TaxReconciliation),
      ).resolves.toBe(false);
    });

    it('is true for Team-depth reconciliation on Team', async () => {
      const { service } = build({
        subscription: { tier: HisaflowPlanTier.TEAM, seatAllowance: 3 },
      });

      await expect(
        service.hasFeature('org_1', TierFeature.TaxReconciliation),
      ).resolves.toBe(true);
    });

    it('is true for the tax floor on Solo', async () => {
      const { service } = build({
        subscription: { tier: HisaflowPlanTier.SOLO, seatAllowance: 1 },
      });

      await expect(
        service.hasFeature('org_1', TierFeature.TaxFiling),
      ).resolves.toBe(true);
    });
  });
});
