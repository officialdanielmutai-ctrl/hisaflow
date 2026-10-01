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

export interface MpesaCheckoutInput {
  organizationId: string;
  tier: HisaflowPlanTier;
  mpesaPhone: string;
  email?: string;
  callbackUrl?: string;
}

export interface MpesaCheckoutResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
  tier: HisaflowPlanTier;
  amountKes: number;
}

/**
 * Normalizes Kenyan M-Pesa numbers to `+2547XXXXXXXX` / `+2541XXXXXXXX`.
 * Exported for tests.
 */
export function normalizeKenyanPhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.startsWith('254')) return `+${digits}`;
  if (digits.startsWith('0')) return `+254${digits.slice(1)}`;
  if (digits.length === 9) return `+254${digits}`;
  return `+${digits}`;
}

/**
 * First-cycle M-Pesa checkout (Phase C frontend dependency, finding F-10).
 *
 * Deliberately separate from `CardCheckoutService` (Section 3.1 vs 3.2). This
 * uses Paystack's standard checkout page with the `mobile_money` channel and
 * no `plan` — the customer completes Paystack's page (selecting M-Pesa and
 * entering their number) and only then receives the STK prompt (Section 3.3).
 * The recurring Subscription is created by the `charge.success` webhook, after
 * which the scheduled `MpesaRenewalService` owns the loop.
 */
@Injectable()
export class MpesaCheckoutService {
  private readonly logger = new Logger(MpesaCheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackService,
    private readonly plans: HisaflowPlansService,
  ) {}

  async start(input: MpesaCheckoutInput): Promise<MpesaCheckoutResult> {
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

    const mpesaPhone = normalizeKenyanPhone(input.mpesaPhone);
    const reference = `HF-MPESA-${plan.tier}-${randomUUID()}`;

    const attempt = await this.prisma.db.paymentAttempt.create({
      data: {
        organizationId: input.organizationId,
        hisaflowPlanId: plan.id,
        amountKes: plan.priceKes,
        method: SubscriptionPaymentMethod.MPESA,
        paystackReference: reference,
        status: PaymentAttemptStatus.PENDING,
        attemptNumber: 1,
      },
    });

    const init = await this.paystack.initializeTransaction({
      email,
      amount: toSubunit(plan.priceKes),
      reference,
      callback_url: input.callbackUrl,
      channels: ['mobile_money'],
      metadata: {
        organizationId: input.organizationId,
        tier: plan.tier,
        hisaflowPlanId: plan.id,
        paymentAttemptId: attempt.id,
        mpesaPhone,
        flow: 'mpesa_first_charge',
      },
    });

    this.logger.log(
      `M-Pesa checkout started for org ${input.organizationId} tier ${plan.tier} (ref=${reference})`,
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
    if (owner?.user?.email) return owner.user.email;

    const anyMember = await this.prisma.db.orgMembership.findFirst({
      where: { organizationId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    return anyMember?.user?.email ?? null;
  }
}
