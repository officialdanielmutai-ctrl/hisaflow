import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { HisaflowPlan, HisaflowPlanTier } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { PaystackService } from '../paystack/paystack.service';
import { toSubunit } from '../paywall.utils';

interface PlanSeed {
  tier: HisaflowPlanTier;
  name: string;
  description: string;
  priceKes: number;
  seatAllowance: number;
  isActive: boolean;
}

/**
 * Seed values for the three tiers. Solo/Team prices come from the Section 7
 * defaults (KES 2,500 / 5,500). Growth pricing was NOT specified anywhere in
 * the doc set, so it is seeded as an existing-but-inactive tier rather than
 * inventing a figure — no Paystack Plan is created for it until the business
 * sets a price and flips `isActive`. This is a deliberate flag, not an
 * oversight.
 */
export const DEFAULT_HISAFLOW_PLANS: PlanSeed[] = [
  {
    tier: HisaflowPlanTier.SOLO,
    name: 'Solo',
    description: 'Single owner-operator, one location',
    priceKes: 2500,
    seatAllowance: 1,
    isActive: true,
  },
  {
    tier: HisaflowPlanTier.TEAM,
    name: 'Team',
    description: 'Owner with staff logins and role-based permissions',
    priceKes: 5500,
    seatAllowance: 3,
    isActive: true,
  },
  {
    tier: HisaflowPlanTier.GROWTH,
    name: 'Growth',
    description: 'Multi-location / multi-site operation with priority support',
    priceKes: 0,
    seatAllowance: 100,
    isActive: false,
  },
];

export interface PlanSyncResult {
  tier: HisaflowPlanTier;
  planCode: string | null;
  skipped: boolean;
  reason?: string;
}

@Injectable()
export class HisaflowPlansService {
  private readonly logger = new Logger(HisaflowPlansService.name);
  private seedPromise?: Promise<void>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackService,
  ) {}

  /**
   * Idempotent seed of the tier rows. Runs lazily on first access (not on
   * module init) so tests and app boot never do surprise writes. `update: {}`
   * means an existing row — e.g. after the business edits Growth's price — is
   * never clobbered by re-seeding.
   */
  async seedDefaults(): Promise<void> {
    for (const plan of DEFAULT_HISAFLOW_PLANS) {
      await this.prisma.db.hisaflowPlan.upsert({
        where: { tier: plan.tier },
        update: {},
        create: {
          tier: plan.tier,
          name: plan.name,
          description: plan.description,
          priceKes: plan.priceKes,
          seatAllowance: plan.seatAllowance,
          isActive: plan.isActive,
        },
      });
    }
  }

  private ensureSeeded(): Promise<void> {
    if (!this.seedPromise) {
      // Reset on failure so a transient DB error does not poison every later
      // call for the lifetime of the process.
      this.seedPromise = this.seedDefaults().catch((err) => {
        this.seedPromise = undefined;
        throw err;
      });
    }
    return this.seedPromise;
  }

  async listActive(): Promise<HisaflowPlan[]> {
    await this.ensureSeeded();
    return this.prisma.db.hisaflowPlan.findMany({
      where: { isActive: true },
      orderBy: { priceKes: 'asc' },
    });
  }

  async listAll(): Promise<HisaflowPlan[]> {
    await this.ensureSeeded();
    return this.prisma.db.hisaflowPlan.findMany({
      orderBy: { priceKes: 'asc' },
    });
  }

  async findByTier(tier: HisaflowPlanTier): Promise<HisaflowPlan | null> {
    await this.ensureSeeded();
    return this.prisma.db.hisaflowPlan.findUnique({ where: { tier } });
  }

  /**
   * Return the Paystack plan code for a tier, creating the Paystack Plan if it
   * does not exist yet. Checks Paystack's plan list first (matching name +
   * amount) so a crash between "created on Paystack" and "stored locally"
   * cannot produce a duplicate Plan on the next attempt.
   */
  async ensurePaystackPlanCode(plan: HisaflowPlan): Promise<string> {
    if (plan.paystackPlanCode) {
      return plan.paystackPlanCode;
    }
    if (!plan.isActive || Number(plan.priceKes) <= 0) {
      throw new BadRequestException(
        `Hisaflow plan ${plan.tier} has no price set — cannot create a Paystack plan`,
      );
    }

    const amount = toSubunit(plan.priceKes);
    const listed = await this.paystack.listPlans();
    const existing = (listed.data ?? []).find(
      (candidate) => candidate.name === plan.name && candidate.amount === amount,
    );

    const planCode =
      existing?.plan_code ??
      (
        await this.paystack.createPlan({
          name: plan.name,
          amount,
          interval: 'monthly',
          description: plan.description ?? undefined,
        })
      ).data.plan_code;

    const updated = await this.prisma.db.hisaflowPlan.update({
      where: { id: plan.id },
      data: { paystackPlanCode: planCode },
    });

    this.logger.log(
      `Hisaflow plan ${plan.tier} → Paystack plan ${planCode}${
        existing ? ' (reused)' : ' (created)'
      }`,
    );
    return updated.paystackPlanCode ?? planCode;
  }

  /**
   * Explicit provisioning pass. Also the operation the admin panel surfaces in
   * Phase F; Phase B exposes it through an admin-gated endpoint.
   */
  async syncPaystackPlans(): Promise<PlanSyncResult[]> {
    const plans = await this.listAll();
    const results: PlanSyncResult[] = [];

    for (const plan of plans) {
      if (!plan.isActive || Number(plan.priceKes) <= 0) {
        results.push({
          tier: plan.tier,
          planCode: plan.paystackPlanCode,
          skipped: true,
          reason: 'tier is not active/priced',
        });
        continue;
      }

      const planCode = await this.ensurePaystackPlanCode(plan);
      results.push({ tier: plan.tier, planCode, skipped: false });
    }

    return results;
  }
}
