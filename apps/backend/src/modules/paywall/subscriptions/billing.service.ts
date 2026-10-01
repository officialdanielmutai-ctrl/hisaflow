import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  HisaflowPlan,
  HisaflowPlanTier,
  PaymentAttempt,
  PaymentAttemptStatus,
  Subscription,
  SubscriptionPaymentMethod,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { FeatureLockedException } from '../../../core/entitlements/feature-locked.exception';
import { TIER_RANK } from '../../../core/entitlements/entitlements.constant';
import { PaystackService } from '../paystack/paystack.service';
import {
  asNumber,
  asString,
  PaystackTransactionListItem,
} from '../paystack/paystack.types';
import { HisaflowPlansService } from '../plans/hisaflow-plans.service';
import { CardCheckoutService } from './card-checkout.service';
import {
  MpesaCheckoutService,
  normalizeKenyanPhone,
} from './mpesa-checkout.service';
import { addMonths } from '../paywall.utils';

type SubscriptionWithPlan = Subscription & { plan: HisaflowPlan };

export interface ChangePlanResult {
  /** Immediate = upgrade (checkout now); scheduled = downgrade at renewal. */
  mode: 'immediate' | 'scheduled';
  tier: HisaflowPlanTier;
  message: string;
  /** Present on an immediate upgrade: the checkout to send the user to. */
  action?: 'checkout';
  method?: SubscriptionPaymentMethod;
  authorizationUrl?: string;
  reference?: string;
  amountKes?: number;
  /** Present on a scheduled downgrade. */
  effectiveAt?: string;
}

export interface SeatUpdateResult {
  seatCount: number;
  seatAllowance: number;
  additionalSeats: number;
  overageSeats: number;
  overageRateKes: number | null;
  autoBilled: boolean;
  message: string;
}

export interface PaymentMethodResult {
  action: 'update_card_link' | 'updated' | 'checkout';
  method: SubscriptionPaymentMethod;
  message: string;
  /** Hosted Paystack card-update link (action = update_card_link). */
  url?: string;
  /** Checkout redirect when switching rails (action = checkout). */
  authorizationUrl?: string;
  reference?: string;
}

export interface InvoiceRecord {
  id: string;
  reference: string | null;
  amountKes: number;
  method: SubscriptionPaymentMethod;
  status: PaymentAttemptStatus;
  planName: string | null;
  planTier: HisaflowPlanTier | null;
  attemptedAt: Date;
  resolvedAt: Date | null;
  errorMessage: string | null;
  /** Where the row came from — Paystack's transaction list, or the local audit trail. */
  source: 'paystack' | 'local';
}

export interface ApplyPlanChangesResult {
  processed: number;
  applied: number;
}

/**
 * Phase E — self-serve billing management.
 *
 * Paystack has **no native change-plan or proration endpoint** (verified against
 * current docs, Section 7 item 5): Plans expose create/list/fetch/update and
 * Subscriptions expose create/list/fetch/enable/disable only. Tier changes are
 * therefore built as **disable-old + create-new**, asymmetric by direction:
 *
 * - **Upgrade** takes effect immediately — the old Paystack subscription is
 *   disabled and a fresh checkout charges the full new cycle (no proration).
 * - **Downgrade** is scheduled for the end of the current cycle — the org stays
 *   on its current tier until `pendingPlanEffectiveAt`, then `PlanChangeJob`
 *   applies it (disabling the old Paystack subscription and creating the lower
 *   one for card; swapping locally for M-Pesa, which HisaFlow already drives).
 *
 * This service is the single owner of subscription tier/seat/method mutations.
 * It calls `CardCheckoutService` / `MpesaCheckoutService` for the actual charge
 * rather than duplicating Phase B/C payment logic.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackService,
    private readonly plans: HisaflowPlansService,
    private readonly cardCheckout: CardCheckoutService,
    private readonly mpesaCheckout: MpesaCheckoutService,
  ) {}

  // ── Tier change ──────────────────────────────────────────────────────────

  async changePlan(
    organizationId: string,
    targetTier: HisaflowPlanTier,
  ): Promise<ChangePlanResult> {
    const subscription = await this.requireSubscription(organizationId);
    const currentTier = subscription.plan.tier;

    if (currentTier === targetTier) {
      throw new BadRequestException(`Organization is already on ${targetTier}`);
    }

    const targetPlan = await this.requireActivePlan(targetTier);
    const isUpgrade = TIER_RANK[targetTier] > TIER_RANK[currentTier];

    if (!isUpgrade) {
      // Downgrade: defer to end of cycle rather than build proration math.
      const effectiveAt = subscription.nextRenewalDate ?? addMonths(new Date(), 1);
      await this.prisma.db.subscription.update({
        where: { id: subscription.id },
        data: {
          pendingTier: targetTier,
          pendingPlanEffectiveAt: effectiveAt,
        },
      });

      this.logger.log(
        `Downgrade scheduled for org ${organizationId}: ${currentTier} → ${targetTier} on ${effectiveAt.toISOString()}`,
      );

      return {
        mode: 'scheduled',
        tier: targetTier,
        effectiveAt: effectiveAt.toISOString(),
        message: `You stay on ${subscription.plan.name} until ${effectiveAt.toDateString()}, then move to ${targetPlan.name}.`,
      };
    }

    // Upgrade: immediate. An upgrade supersedes any pending downgrade.
    await this.prisma.db.subscription.update({
      where: { id: subscription.id },
      data: { pendingTier: null, pendingPlanEffectiveAt: null },
    });

    // Disable the old Paystack subscription before creating the new one so the
    // customer is never charged on both (disable-old/create-new).
    if (
      subscription.paymentMethod === SubscriptionPaymentMethod.CARD &&
      subscription.paystackSubscriptionCode
    ) {
      await this.paystack.disableSubscription(
        subscription.paystackSubscriptionCode,
      );
    }

    const checkout =
      subscription.paymentMethod === SubscriptionPaymentMethod.CARD
        ? await this.cardCheckout.start({ organizationId, tier: targetTier })
        : await this.startMpesaCheckout(subscription, targetTier);

    this.logger.log(
      `Upgrade started for org ${organizationId}: ${currentTier} → ${targetTier} (${subscription.paymentMethod})`,
    );

    return {
      mode: 'immediate',
      action: 'checkout',
      method: subscription.paymentMethod,
      authorizationUrl: checkout.authorizationUrl,
      reference: checkout.reference,
      amountKes: checkout.amountKes,
      tier: targetTier,
      message: `Complete payment to move to ${targetPlan.name} now.`,
    };
  }

  // ── Seats ────────────────────────────────────────────────────────────────

  async updateSeats(
    organizationId: string,
    additionalSeats: number,
  ): Promise<SeatUpdateResult> {
    const subscription = await this.requireSubscription(organizationId);
    const plan = subscription.plan;

    // Seats are Team-tier depth (Section 1A): Solo can only have the owner.
    if (plan.tier === HisaflowPlanTier.SOLO && additionalSeats > 0) {
      throw new FeatureLockedException({
        reason: 'seat_limit',
        feature: 'staff',
        requiredTier: HisaflowPlanTier.TEAM,
        currentTier: plan.tier,
        message:
          'Extra seats are a Team feature. Upgrade to Team to add staff seats.',
      });
    }

    const seatCount = await this.prisma.db.orgMembership.count({
      where: { organizationId },
    });
    const seatAllowance = plan.seatAllowance + additionalSeats;
    const overageSeats = Math.max(0, seatCount - seatAllowance);
    const overageRateKes =
      plan.perSeatOverageKes == null ? null : Number(plan.perSeatOverageKes);
    const autoBilled =
      plan.tier !== HisaflowPlanTier.SOLO && overageSeats > 0;

    await this.prisma.db.subscription.update({
      where: { id: subscription.id },
      data: { seatAllowance, seatCount },
    });

    return {
      seatCount,
      seatAllowance,
      additionalSeats,
      overageSeats,
      overageRateKes,
      autoBilled,
      message:
        overageSeats > 0
          ? `${overageSeats} seat(s) above the plan allowance will be billed on the next cycle.`
          : `${seatCount} of ${seatAllowance} seats used.`,
    };
  }

  // ── Payment method ───────────────────────────────────────────────────────

  async changePaymentMethod(
    organizationId: string,
    method: SubscriptionPaymentMethod,
    mpesaPhone?: string,
  ): Promise<PaymentMethodResult> {
    const subscription = await this.requireSubscription(organizationId);

    if (method === subscription.paymentMethod) {
      if (method === SubscriptionPaymentMethod.CARD) {
        if (!subscription.paystackSubscriptionCode) {
          throw new BadRequestException(
            'No card subscription is on file to update',
          );
        }
        const link = await this.paystack.generateUpdateSubscriptionLink(
          subscription.paystackSubscriptionCode,
        );
        return {
          action: 'update_card_link',
          method,
          url: link.data.link,
          message: 'Open Paystack to update the card on this subscription.',
        };
      }

      const phone = mpesaPhone ?? subscription.mpesaPhone;
      if (!phone) {
        throw new BadRequestException(
          'An M-Pesa phone number is required',
        );
      }
      await this.prisma.db.subscription.update({
        where: { id: subscription.id },
        data: { mpesaPhone: normalizeKenyanPhone(phone) },
      });
      return {
        action: 'updated',
        method,
        message: 'M-Pesa number updated.',
      };
    }

    // Switching rails is a new subscription (disable-old/create-new again).
    if (
      subscription.paymentMethod === SubscriptionPaymentMethod.CARD &&
      subscription.paystackSubscriptionCode
    ) {
      await this.paystack.disableSubscription(
        subscription.paystackSubscriptionCode,
      );
    }

    if (method === SubscriptionPaymentMethod.CARD) {
      const checkout = await this.cardCheckout.start({
        organizationId,
        tier: subscription.plan.tier,
      });
      return {
        action: 'checkout',
        method,
        authorizationUrl: checkout.authorizationUrl,
        reference: checkout.reference,
        message: 'Complete card checkout to switch payment method.',
      };
    }

    const phone = mpesaPhone ?? subscription.mpesaPhone;
    if (!phone) {
      throw new BadRequestException('An M-Pesa phone number is required');
    }
    const checkout = await this.mpesaCheckout.start({
      organizationId,
      tier: subscription.plan.tier,
      mpesaPhone: phone,
    });
    return {
      action: 'checkout',
      method,
      authorizationUrl: checkout.authorizationUrl,
      reference: checkout.reference,
      message: 'Complete M-Pesa checkout to switch payment method.',
    };
  }

  // ── Invoice / receipt history ────────────────────────────────────────────

  /**
   * Receipt history, pulled from Paystack's Transactions list for the org
   * (Phase E frontend bullet). Paystack's list filter needs the numeric
   * customer id, so the stored `CUS_` code is resolved to an id first. If
   * Paystack is unreachable/not configured, or returns nothing, this falls back
   * to the `PaymentAttempt` audit trail (Section 4) so the screen never goes
   * blank — and says which source it used.
   */
  async listInvoices(organizationId: string): Promise<InvoiceRecord[]> {
    const [subscription, attempts] = await Promise.all([
      this.prisma.db.subscription.findUnique({
        where: { organizationId },
        select: { paystackCustomerCode: true },
      }),
      this.prisma.db.paymentAttempt.findMany({
        where: { organizationId },
        include: { plan: true },
        orderBy: { attemptedAt: 'desc' },
        take: 100,
      }),
    ]);

    const customerCode = subscription?.paystackCustomerCode;
    if (customerCode) {
      try {
        const customer = await this.paystack.fetchCustomer(customerCode);
        const listed = await this.paystack.listTransactions({
          customerId: customer.data.id,
          perPage: 50,
        });
        const rows = listed.data ?? [];
        if (rows.length > 0) {
          const localByReference = new Map(
            attempts
              .filter((attempt) => Boolean(attempt.paystackReference))
              .map((attempt) => [attempt.paystackReference as string, attempt]),
          );
          return rows.map((tx) =>
            this.mapPaystackTransaction(tx, localByReference),
          );
        }
      } catch (err) {
        this.logger.warn(
          `Paystack transactions fetch failed for org ${organizationId}; using local audit trail: ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    }

    return attempts.map((attempt) => this.mapLocalAttempt(attempt));
  }

  private mapLocalAttempt(
    attempt: PaymentAttempt & { plan: HisaflowPlan | null },
  ): InvoiceRecord {
    return {
      id: attempt.id,
      reference: attempt.paystackReference,
      amountKes: Number(attempt.amountKes),
      method: attempt.method,
      status: attempt.status,
      planName: attempt.plan?.name ?? null,
      planTier: attempt.plan?.tier ?? null,
      attemptedAt: attempt.attemptedAt,
      resolvedAt: attempt.resolvedAt,
      errorMessage: attempt.errorMessage,
      source: 'local',
    };
  }

  private mapPaystackTransaction(
    tx: PaystackTransactionListItem,
    localByReference: Map<
      string,
      PaymentAttempt & { plan: HisaflowPlan | null }
    >,
  ): InvoiceRecord {
    const reference = asString(tx.reference) ?? null;
    const local = reference ? localByReference.get(reference) : undefined;
    const channel = asString(tx.channel)?.toLowerCase();

    return {
      id: `ps_${asString(tx.id) ?? reference ?? Math.random().toString(36).slice(2)}`,
      reference,
      amountKes: (asNumber(tx.amount) ?? 0) / 100,
      method:
        channel === 'mobile_money'
          ? SubscriptionPaymentMethod.MPESA
          : SubscriptionPaymentMethod.CARD,
      status: this.paystackAttemptStatus(tx.status),
      planName: local?.plan?.name ?? null,
      planTier: local?.plan?.tier ?? null,
      attemptedAt:
        this.parseDate(tx.created_at) ??
        this.parseDate(tx.paid_at) ??
        new Date(),
      resolvedAt: this.parseDate(tx.paid_at) ?? null,
      errorMessage:
        local?.errorMessage ?? asString(tx.gateway_response) ?? null,
      source: 'paystack',
    };
  }

  private paystackAttemptStatus(status?: string): PaymentAttemptStatus {
    switch ((status ?? '').toLowerCase()) {
      case 'success':
        return PaymentAttemptStatus.SUCCESS;
      case 'failed':
      case 'abandoned':
      case 'reversed':
        return PaymentAttemptStatus.FAILED;
      default:
        return PaymentAttemptStatus.PENDING;
    }
  }

  private parseDate(value: unknown): Date | undefined {
    const raw = asString(value);
    if (!raw) return undefined;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  // ── Deferred downgrade application (called by PlanChangeJob) ─────────────

  async applyDuePlanChanges(
    now = new Date(),
  ): Promise<ApplyPlanChangesResult> {
    const subscriptions = await this.prisma.db.subscription.findMany({
      where: {
        pendingTier: { not: null },
        pendingPlanEffectiveAt: { not: null, lte: now },
      },
      include: { plan: true },
    });

    let applied = 0;
    for (const subscription of subscriptions) {
      try {
        if (await this.applyPendingChange(subscription, now)) {
          applied += 1;
        }
      } catch (err) {
        this.logger.error(
          `Failed to apply pending plan change for subscription ${subscription.id}: ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    }

    return { processed: subscriptions.length, applied };
  }

  /**
   * Apply one scheduled downgrade. Card moves to the new Paystack subscription
   * (disable old, create new); M-Pesa simply swaps the local plan so the next
   * renewal charges the lower price. Additional purchased seats are preserved
   * across the tier change.
   */
  private async applyPendingChange(
    subscription: SubscriptionWithPlan,
    now: Date,
  ): Promise<boolean> {
    const pendingTier = subscription.pendingTier;
    if (!pendingTier) return false;

    const targetPlan = await this.plans.findByTier(pendingTier);
    if (!targetPlan || !targetPlan.isActive || Number(targetPlan.priceKes) <= 0) {
      this.logger.warn(
        `Pending tier ${pendingTier} is not active/priced — leaving subscription ${subscription.id} unchanged`,
      );
      return false;
    }

    const additionalSeats = Math.max(
      0,
      subscription.seatAllowance - subscription.plan.seatAllowance,
    );
    const seatAllowance = targetPlan.seatAllowance + additionalSeats;

    if (
      subscription.paymentMethod === SubscriptionPaymentMethod.CARD &&
      subscription.paystackSubscriptionCode &&
      subscription.paystackCustomerCode
    ) {
      await this.paystack.disableSubscription(
        subscription.paystackSubscriptionCode,
      );
      const planCode = await this.plans.ensurePaystackPlanCode(targetPlan);
      const created = await this.paystack.createSubscription({
        customer: subscription.paystackCustomerCode,
        plan: planCode,
      });

      await this.prisma.db.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: targetPlan.id,
          seatAllowance,
          pendingTier: null,
          pendingPlanEffectiveAt: null,
          paystackSubscriptionCode:
            created.data?.subscription_code ??
            subscription.paystackSubscriptionCode,
          nextRenewalDate: addMonths(now, 1),
        },
      });
    } else {
      await this.prisma.db.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: targetPlan.id,
          seatAllowance,
          pendingTier: null,
          pendingPlanEffectiveAt: null,
        },
      });
    }

    this.logger.log(
      `Pending downgrade applied for subscription ${subscription.id} → ${pendingTier}`,
    );
    return true;
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async requireSubscription(
    organizationId: string,
  ): Promise<SubscriptionWithPlan> {
    const subscription = await this.prisma.db.subscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });
    if (!subscription) {
      throw new BadRequestException(
        'No subscription on file. Choose a plan on the paywall first.',
      );
    }
    return subscription;
  }

  private async requireActivePlan(
    tier: HisaflowPlanTier,
  ): Promise<HisaflowPlan> {
    const plan = await this.plans.findByTier(tier);
    if (!plan || !plan.isActive || Number(plan.priceKes) <= 0) {
      throw new BadRequestException(
        `Hisaflow plan ${tier} is not available for purchase`,
      );
    }
    return plan;
  }

  private async startMpesaCheckout(
    subscription: SubscriptionWithPlan,
    targetTier: HisaflowPlanTier,
  ) {
    const phone = subscription.mpesaPhone;
    if (!phone) {
      throw new BadRequestException(
        'Add an M-Pesa number before upgrading on this payment method',
      );
    }
    return this.mpesaCheckout.start({
      organizationId: subscription.organizationId,
      tier: targetTier,
      mpesaPhone: phone,
    });
  }
}
