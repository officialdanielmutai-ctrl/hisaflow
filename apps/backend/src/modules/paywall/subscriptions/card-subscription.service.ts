import { Injectable, Logger } from '@nestjs/common';
import {
  HisaflowPlan,
  PaymentAttemptStatus,
  Subscription,
  SubscriptionPaymentMethod,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import {
  asNumber,
  asString,
  getCustomerCode,
  getCustomerEmail,
  getNextPaymentDate,
  getOrganizationIdFromMetadata,
  getPlanCode,
  getSubscriptionCode,
  PaystackWebhookData,
} from '../paystack/paystack.types';
import { addMonths } from '../paywall.utils';

/** Section 7 default: 5 days from missed due date to feature lockout. */
export const GRACE_PERIOD_DAYS = 5;

interface ActivateSubscriptionInput {
  organizationId: string;
  plan: HisaflowPlan | null;
  subscriptionCode?: string;
  customerCode?: string;
  nextRenewalDate: Date;
}

/**
 * Card subscription state sync — the Phase B half of webhook consumption.
 *
 * This is deliberately the *only* place card-native recurring state is
 * mutated. Phase C's M-Pesa manual renewal loop is a separate service with its
 * own code path; a `mobile_money` charge is never routed here (see
 * PaystackEventHandlerService). Paystack owns the renewal schedule for cards,
 * so this service only reacts to the outcome.
 */
@Injectable()
export class CardSubscriptionService {
  private readonly logger = new Logger(CardSubscriptionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * A card charge succeeded — first cycle or a Paystack-driven auto-renewal.
   * Links the matching PaymentAttempt, (re)activates the Subscription, and
   * advances the renewal date.
   */
  async handleChargeSuccess(data: PaystackWebhookData): Promise<void> {
    const reference = asString(data.reference);
    const attempt = reference
      ? await this.prisma.db.paymentAttempt.findUnique({
          where: { paystackReference: reference },
          include: { plan: true },
        })
      : null;

    const organizationId =
      attempt?.organizationId ??
      getOrganizationIdFromMetadata(data) ??
      (await this.resolveOrganizationId(data));

    if (!organizationId) {
      this.logger.warn(
        `charge.success ${reference ?? '(no ref)'}: organization could not be resolved — left for admin review`,
      );
      return;
    }

    const plan = attempt?.plan ?? (await this.resolvePlan(data));
    const amountKes = this.amountKes(data);

    const subscription = await this.activateSubscription({
      organizationId,
      plan,
      subscriptionCode: getSubscriptionCode(data),
      customerCode: getCustomerCode(data),
      nextRenewalDate: getNextPaymentDate(data) ?? addMonths(new Date(), 1),
    });

    const updateData = {
      status: PaymentAttemptStatus.SUCCESS,
      subscriptionId: subscription.id,
      hisaflowPlanId: plan?.id ?? attempt?.hisaflowPlanId ?? null,
      resolvedAt: new Date(),
      errorMessage: null,
    };

    if (attempt) {
      await this.prisma.db.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          ...updateData,
          amountKes: amountKes ?? attempt.amountKes,
        },
      });
    } else if (reference) {
      // Paystack-initiated auto-renewal with no locally pre-created attempt.
      await this.prisma.db.paymentAttempt.upsert({
        where: { paystackReference: reference },
        update: updateData,
        create: {
          organizationId,
          subscriptionId: subscription.id,
          hisaflowPlanId: plan?.id ?? null,
          amountKes: amountKes ?? plan?.priceKes ?? 0,
          method: SubscriptionPaymentMethod.CARD,
          paystackReference: reference,
          status: PaymentAttemptStatus.SUCCESS,
          attemptNumber: 1,
          resolvedAt: new Date(),
        },
      });
    }

    this.logger.log(
      `charge.success processed for org ${organizationId} (ref=${reference ?? 'n/a'})`,
    );
  }

  /**
   * Paystack confirms the recurring Subscription exists. Also the first point
   * at which a card subscription code is available to store.
   */
  async handleSubscriptionCreate(data: PaystackWebhookData): Promise<void> {
    const organizationId =
      getOrganizationIdFromMetadata(data) ??
      (await this.resolveOrganizationId(data));

    if (!organizationId) {
      this.logger.warn(
        `subscription.create ${getSubscriptionCode(data) ?? '(no code)'}: organization could not be resolved`,
      );
      return;
    }

    await this.activateSubscription({
      organizationId,
      plan: await this.resolvePlan(data),
      subscriptionCode: getSubscriptionCode(data),
      customerCode: getCustomerCode(data),
      nextRenewalDate: getNextPaymentDate(data) ?? addMonths(new Date(), 1),
    });

    this.logger.log(`subscription.create linked to org ${organizationId}`);
  }

  /**
   * A Paystack renewal charge failed. This is the GRACE signal (Section 3.4 /
   * Phase B "Done when"). Paystack keeps retrying; HisaFlow reacts.
   */
  async handleInvoicePaymentFailed(data: PaystackWebhookData): Promise<void> {
    const code = getSubscriptionCode(data);
    const organizationId =
      getOrganizationIdFromMetadata(data) ??
      (await this.resolveOrganizationId(data));

    const subscription = code
      ? await this.prisma.db.subscription.findFirst({
          where: { paystackSubscriptionCode: code },
        })
      : organizationId
        ? await this.prisma.db.subscription.findUnique({
            where: { organizationId },
          })
        : null;

    if (!subscription) {
      this.logger.warn(
        `invoice.payment_failed ${code ?? '(no code)'}: no matching subscription found`,
      );
      return;
    }

    const graceEndsAt = new Date();
    graceEndsAt.setDate(graceEndsAt.getDate() + GRACE_PERIOD_DAYS);

    await this.prisma.db.subscription.update({
      where: { id: subscription.id },
      data: { status: SubscriptionStatus.GRACE, graceEndsAt },
    });

    const reference = asString(data.reference);
    const amountKes = this.amountKes(data);
    if (reference) {
      await this.prisma.db.paymentAttempt.upsert({
        where: { paystackReference: reference },
        update: {
          status: PaymentAttemptStatus.FAILED,
          subscriptionId: subscription.id,
          resolvedAt: new Date(),
          errorMessage: 'Paystack reported a failed renewal charge',
        },
        create: {
          organizationId: subscription.organizationId,
          subscriptionId: subscription.id,
          hisaflowPlanId: subscription.planId,
          amountKes: amountKes ?? 0,
          method: SubscriptionPaymentMethod.CARD,
          paystackReference: reference,
          status: PaymentAttemptStatus.FAILED,
          attemptNumber: 1,
          errorMessage: 'Paystack reported a failed renewal charge',
          resolvedAt: new Date(),
        },
      });
    }

    this.logger.warn(
      `Subscription ${subscription.id} moved to GRACE until ${graceEndsAt.toISOString()}`,
    );
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async activateSubscription(
    input: ActivateSubscriptionInput,
  ): Promise<Subscription> {
    const existing = await this.prisma.db.subscription.findUnique({
      where: { organizationId: input.organizationId },
    });

    const planId = input.plan?.id ?? existing?.planId;
    if (!planId) {
      throw new Error(
        `No HisaflowPlan available to activate a subscription for org ${input.organizationId}`,
      );
    }
    const seatAllowance =
      input.plan?.seatAllowance ?? existing?.seatAllowance ?? 1;

    if (!existing) {
      return this.prisma.db.subscription.create({
        data: {
          organizationId: input.organizationId,
          planId,
          seatCount: 1,
          seatAllowance,
          status: SubscriptionStatus.ACTIVE,
          paymentMethod: SubscriptionPaymentMethod.CARD,
          nextRenewalDate: input.nextRenewalDate,
          paystackSubscriptionCode: input.subscriptionCode ?? null,
          paystackCustomerCode: input.customerCode ?? null,
          graceEndsAt: null,
        },
      });
    }

    return this.prisma.db.subscription.update({
      where: { id: existing.id },
      data: {
        planId,
        seatAllowance: input.plan ? seatAllowance : existing.seatAllowance,
        status: SubscriptionStatus.ACTIVE,
        paymentMethod: SubscriptionPaymentMethod.CARD,
        nextRenewalDate: input.nextRenewalDate,
        paystackSubscriptionCode:
          input.subscriptionCode ?? existing.paystackSubscriptionCode,
        paystackCustomerCode:
          input.customerCode ?? existing.paystackCustomerCode,
        graceEndsAt: null,
      },
    });
  }

  /**
   * Resolve the owning org from the identifiers Paystack includes. Order
   * matters: stored references are authoritative, email is the last resort.
   */
  private async resolveOrganizationId(
    data: PaystackWebhookData,
  ): Promise<string | null> {
    const code = getSubscriptionCode(data);
    if (code) {
      const bySubscription = await this.prisma.db.subscription.findFirst({
        where: { paystackSubscriptionCode: code },
      });
      if (bySubscription) return bySubscription.organizationId;
    }

    const customerCode = getCustomerCode(data);
    if (customerCode) {
      const byCustomer = await this.prisma.db.subscription.findFirst({
        where: { paystackCustomerCode: customerCode },
      });
      if (byCustomer) return byCustomer.organizationId;
    }

    const email = getCustomerEmail(data);
    if (email) {
      const user = await this.prisma.db.user.findUnique({ where: { email } });
      if (user) {
        const membership = await this.prisma.db.orgMembership.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: 'asc' },
        });
        if (membership) return membership.organizationId;
      }
    }

    return null;
  }

  private async resolvePlan(
    data: PaystackWebhookData,
  ): Promise<HisaflowPlan | null> {
    const planCode = getPlanCode(data);
    if (!planCode) return null;
    return this.prisma.db.hisaflowPlan.findFirst({
      where: { paystackPlanCode: planCode },
    });
  }

  /** Paystack amounts are in the smallest unit; our model stores KES. */
  private amountKes(data: PaystackWebhookData): number | undefined {
    const amount = asNumber(data.amount);
    return amount === undefined ? undefined : amount / 100;
  }
}
