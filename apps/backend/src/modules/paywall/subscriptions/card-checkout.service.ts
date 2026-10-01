import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  HisaflowPlanTier,
  PaymentAttemptStatus,
  SubscriptionPaymentMethod,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { PaystackService } from '../paystack/paystack.service';
import { HisaflowPlansService } from '../plans/hisaflow-plans.service';
import { toSubunit } from '../paywall.utils';

export interface CardCheckoutInput {
  organizationId: string;
  tier: HisaflowPlanTier;
  email?: string;
  callbackUrl?: string;
}

export interface CardCheckoutResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
  tier: HisaflowPlanTier;
  amountKes: number;
}

/**
 * Card-only checkout (Phase B).
 *
 * Uses Paystack's standard checkout with the `plan` code attached, so the one
 * redirect both charges the first cycle and creates the recurring Subscription
 * (Section 3.1). M-Pesa checkout is a separate Phase C flow — do not add a
 * channel branch here that turns this into shared card/M-Pesa logic.
 */
@Injectable()
export class CardCheckoutService {
  private readonly logger = new Logger(CardCheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackService,
    private readonly plans: HisaflowPlansService,
  ) {}

  async start(input: CardCheckoutInput): Promise<CardCheckoutResult> {
    const plan = await this.plans.findByTier(input.tier);
    if (!plan || !plan.isActive) {
      throw new BadRequestException(
        `Hisaflow plan ${input.tier} is not available for checkout`,
      );
    }
    if (Number(plan.priceKes) <= 0) {
      throw new BadRequestException(
        `Hisaflow plan ${input.tier} has no price configured`,
      );
    }

    const email =
      input.email ?? (await this.resolveBillingEmail(input.organizationId));
    if (!email) {
      throw new BadRequestException(
        'No billing email is available for this organization',
      );
    }

    // Ensure the Paystack Plan exists before initializing checkout.
    const planCode = await this.plans.ensurePaystackPlanCode(plan);

    // Custom reference ties the webhook back to this attempt even before the
    // Paystack Subscription exists locally.
    const reference = `HF-${plan.tier}-${randomUUID()}`;

    const attempt = await this.prisma.db.paymentAttempt.create({
      data: {
        organizationId: input.organizationId,
        hisaflowPlanId: plan.id,
        amountKes: plan.priceKes,
        method: SubscriptionPaymentMethod.CARD,
        paystackReference: reference,
        status: PaymentAttemptStatus.PENDING,
        attemptNumber: 1,
      },
    });

    const init = await this.paystack.initializeTransaction({
      email,
      amount: toSubunit(plan.priceKes),
      plan: planCode,
      reference,
      callback_url: input.callbackUrl,
      channels: ['card'],
      metadata: {
        organizationId: input.organizationId,
        tier: plan.tier,
        hisaflowPlanId: plan.id,
        paymentAttemptId: attempt.id,
      },
    });

    this.logger.log(
      `Card checkout started for org ${input.organizationId} tier ${plan.tier} (ref=${reference})`,
    );

    return {
      authorizationUrl: init.data.authorization_url,
      accessCode: init.data.access_code,
      reference: init.data.reference,
      tier: plan.tier,
      amountKes: Number(plan.priceKes),
    };
  }

  private async resolveBillingEmail(
    organizationId: string,
  ): Promise<string | null> {
    const owner = await this.prisma.db.orgMembership.findFirst({
      where: { organizationId, role: 'OWNER' },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    if (owner?.user?.email) {
      return owner.user.email;
    }

    const anyMember = await this.prisma.db.orgMembership.findFirst({
      where: { organizationId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    return anyMember?.user?.email ?? null;
  }
}
