import { Injectable } from '@nestjs/common';
import { HisaflowPlanTier, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma.service';
import { FeatureLockedException } from './feature-locked.exception';
import {
  MIN_TIER_BY_FEATURE,
  TierFeature,
  tierAtLeast,
  TRIAL_SEAT_ALLOWANCE,
  TRIAL_TIER,
} from './entitlements.constant';

export interface OrgEntitlements {
  /** Effective tier — a no-subscription org is treated as the Team trial. */
  tier: HisaflowPlanTier;
  status: SubscriptionStatus | null;
  hasSubscription: boolean;
  isActive: boolean;
  seatAllowance: number;
  seatCount: number;
  canAutoBillSeats: boolean;
}

export interface SeatDecision {
  allowed: true;
  /** Extra seats above the allowance that will be billed next cycle. */
  overage: number;
  autoBilled: boolean;
}

/**
 * The one place that answers "what is this org entitled to?".
 *
 * This is the tier dimension layered onto the existing vertical
 * (`businessType`) gate: callers keep their existing guards and simply add a
 * `@RequiresFeatures(...)` check, rather than each vertical growing its own
 * billing logic. Seat policy lives here too because it is the same question.
 */
@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(organizationId: string): Promise<OrgEntitlements> {
    const [subscription, seatCount] = await Promise.all([
      this.prisma.db.subscription.findUnique({
        where: { organizationId },
        include: { plan: true },
      }),
      this.prisma.db.orgMembership.count({ where: { organizationId } }),
    ]);

    if (!subscription) {
      // No plan chosen yet = the defaulted 14-day Team trial (Section 7).
      // Trial mechanics/expiry are out of scope; this keeps new orgs unblocked.
      return {
        tier: TRIAL_TIER,
        status: null,
        hasSubscription: false,
        isActive: true,
        seatAllowance: TRIAL_SEAT_ALLOWANCE,
        seatCount,
        canAutoBillSeats: false,
      };
    }

    const isActive =
      subscription.status === SubscriptionStatus.ACTIVE ||
      subscription.status === SubscriptionStatus.GRACE;

    return {
      tier: subscription.plan.tier,
      status: subscription.status,
      hasSubscription: true,
      isActive,
      seatAllowance: subscription.seatAllowance,
      seatCount,
      canAutoBillSeats:
        isActive &&
        (subscription.plan.tier === HisaflowPlanTier.TEAM ||
          subscription.plan.tier === HisaflowPlanTier.GROWTH),
    };
  }

  /**
   * Throws `FeatureLockedException` for the first feature the org is not
   * entitled to. Floor features always pass on an active org.
   */
  async assertFeatures(
    organizationId: string,
    features: TierFeature[],
  ): Promise<OrgEntitlements> {
    const entitlements = await this.resolve(organizationId);

    for (const feature of features) {
      const minimum = MIN_TIER_BY_FEATURE[feature];
      const enabled =
        entitlements.isActive && tierAtLeast(entitlements.tier, minimum);

      if (!enabled) {
        throw new FeatureLockedException({
          reason: 'feature_lock',
          feature: this.paywallKeyForFeature(feature),
          requiredTier: minimum,
          currentTier: entitlements.hasSubscription ? entitlements.tier : null,
          message: this.messageFor(feature, minimum),
        });
      }
    }

    return entitlements;
  }

  /**
   * Non-throwing entitlement check, for background jobs that must silently
   * skip an org rather than raise a feature-lock error.
   */
  async hasFeature(
    organizationId: string,
    feature: TierFeature,
  ): Promise<boolean> {
    const entitlements = await this.resolve(organizationId);
    return (
      entitlements.isActive &&
      tierAtLeast(entitlements.tier, MIN_TIER_BY_FEATURE[feature])
    );
  }

  /**
   * Never blocks a Team/Growth org that is over its included seats — it
   * reports the overage so the next renewal bills it (Section 7 item 4).
   * Solo (and an unbilled trial) has no seat add-on, so it gates to Team.
   */
  async assertSeatAvailable(organizationId: string): Promise<SeatDecision> {
    const entitlements = await this.resolve(organizationId);

    if (entitlements.seatCount < entitlements.seatAllowance) {
      return { allowed: true, overage: 0, autoBilled: false };
    }

    if (!entitlements.canAutoBillSeats) {
      throw new FeatureLockedException({
        reason: 'seat_limit',
        feature: 'staff',
        requiredTier: HisaflowPlanTier.TEAM,
        currentTier: entitlements.hasSubscription
          ? entitlements.tier
          : null,
        message:
          'Your plan does not include another staff seat. Upgrade to Team to add staff.',
      });
    }

    return {
      allowed: true,
      overage: entitlements.seatCount - entitlements.seatAllowance + 1,
      autoBilled: true,
    };
  }

  /** Recomputes the stored seat count from the real membership rows. */
  async syncSeatCount(organizationId: string): Promise<number> {
    const seatCount = await this.prisma.db.orgMembership.count({
      where: { organizationId },
    });
    await this.prisma.db.subscription.updateMany({
      where: { organizationId },
      data: { seatCount },
    });
    return seatCount;
  }

  /**
   * Quantity gate for the Growth multi-location feature: the first router /
   * location is part of the vertical base, the second and beyond need Growth.
   * `featureKey` lets the ISP vertical report 'isp-routers' for context.
   */
  async assertMultiLocationAllowed(
    organizationId: string,
    existingLocations: number,
    featureKey = 'multi-location',
  ): Promise<void> {
    if (existingLocations < 1) return;

    const entitlements = await this.resolve(organizationId);
    if (
      !entitlements.isActive ||
      !tierAtLeast(entitlements.tier, HisaflowPlanTier.GROWTH)
    ) {
      throw new FeatureLockedException({
        reason: 'feature_lock',
        feature: featureKey,
        requiredTier: HisaflowPlanTier.GROWTH,
        currentTier: entitlements.hasSubscription ? entitlements.tier : null,
        message:
          'Multiple locations are a Growth feature. Upgrade to add another location.',
      });
    }
  }

  private paywallKeyForFeature(feature: TierFeature): string {
    switch (feature) {
      case TierFeature.RolePermissions:
      case TierFeature.VerticalDepth:
        return 'staff';
      case TierFeature.AnalyticsForecasting:
      case TierFeature.InventoryIntelligence:
      case TierFeature.FinanceTrends:
        return 'forecasting';
      case TierFeature.TaxReconciliation:
        return 'reconciliation';
      case TierFeature.MultiLocation:
        return 'multi-location';
      default:
        return feature;
    }
  }

  private messageFor(
    feature: TierFeature,
    minimum: HisaflowPlanTier,
  ): string {
    switch (feature) {
      case TierFeature.MultiLocation:
        return 'Multiple locations are a Growth feature.';
      case TierFeature.RolePermissions:
        return 'Role-based permissions are a Team feature.';
      case TierFeature.TaxReconciliation:
        return 'Reconciliation is a Team feature.';
      default:
        return `This feature requires the ${minimum.charAt(0)}${minimum
          .slice(1)
          .toLowerCase()} plan.`;
    }
  }
}
