import { Injectable, Logger } from '@nestjs/common';
import {
  AlertSeverity,
  AlertStatus,
  AlertType,
  HisaflowPlan,
  PaymentAttempt,
  PaymentAttemptStatus,
  Subscription,
  SubscriptionPaymentMethod,
  SubscriptionStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AfricasTalkingProvider } from '../../../infrastructure/providers/africas-talking.provider';
import { NotificationsService } from '../../notifications/notifications.service';
import { PaystackService } from '../paystack/paystack.service';
import {
  asNumber,
  asString,
  getMpesaPhone,
  PaystackWebhookData,
} from '../paystack/paystack.types';
import { addDays, addMonths, toSubunit } from '../paywall.utils';

/**
 * Section 7 defaults. Retries land on the due date (day 0), day 2 and day 4;
 * feature lockout is 5 days from the missed due date. The reminder goes out a
 * few days ahead.
 */
export const MPESA_RETRY_OFFSETS_DAYS = [0, 2, 4];
export const GRACE_PERIOD_DAYS = 5;
export const MPESA_REMINDER_DAYS = 3;
export const MPESA_PROVIDER = 'mpesa';

/**
 * A PENDING mobile-money charge older than this is treated as timed out. The
 * STK prompt can be ignored or the webhook can be lost; without this the loop
 * would wait forever instead of moving to the next retry.
 */
export const MPESA_PENDING_TIMEOUT_MS = 30 * 60 * 1000;

type SubscriptionWithPlan = Subscription & { plan: HisaflowPlan };

export interface MpesaRenewalRunResult {
  processed: number;
  charged: number;
  movedToGrace: number;
}

export type MpesaSubscriptionOutcome =
  | 'charged'
  | 'waiting'
  | 'grace'
  | 'skipped';

/**
 * Phase C — HisaFlow-owned M-Pesa renewal loop.
 *
 * This is deliberately separate from `CardSubscriptionService`: Paystack runs
 * card renewals natively, while HisaFlow schedules and retries M-Pesa charges
 * itself (Section 3.2). Do not fold the two into one conditional code path.
 *
 * The retry convention mirrors the ISP vertical's `RouterAction` — one audit
 * row per attempt (`PaymentAttempt`), a bounded attempt count, the error
 * captured on the row, and escalation only after the bound is exhausted. The
 * only difference is the delay: `RouterAction` retries in seconds within one
 * call, whereas the Section 7 cadence spreads retries across day 0/2/4, so the
 * job is re-entrant and decides which offset it is at from the attempt count.
 */
@Injectable()
export class MpesaRenewalService {
  private readonly logger = new Logger(MpesaRenewalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackService,
    private readonly notifications: NotificationsService,
    private readonly africasTalking: AfricasTalkingProvider,
  ) {}

  // ── Reminder ─────────────────────────────────────────────────────────────

  /** Sends one reminder per cycle for subscriptions approaching their due date. */
  async sendDueReminders(now = new Date()): Promise<number> {
    const windowEnd = addDays(now, MPESA_REMINDER_DAYS);
    const subscriptions = await this.prisma.db.subscription.findMany({
      where: {
        paymentMethod: SubscriptionPaymentMethod.MPESA,
        status: SubscriptionStatus.ACTIVE,
        renewalReminderSentAt: null,
        nextRenewalDate: { not: null, gte: now, lte: windowEnd },
      },
      include: { plan: true },
    });

    for (const subscription of subscriptions) {
      await this.sendReminder(subscription, now);
    }

    return subscriptions.length;
  }

  private async sendReminder(
    subscription: SubscriptionWithPlan,
    now: Date,
  ): Promise<void> {
    const organization = await this.prisma.db.organization.findUnique({
      where: { id: subscription.organizationId },
      select: { name: true, phone: true },
    });

    const dueText = subscription.nextRenewalDate
      ? this.formatDate(subscription.nextRenewalDate)
      : 'soon';
    const body = `Your ${subscription.plan.name} plan renews on ${dueText}. We will send an M-Pesa prompt to ${subscription.mpesaPhone ?? 'your registered phone'}.`;

    await this.prisma.db.alert.create({
      data: {
        organizationId: subscription.organizationId,
        itemId: null,
        type: AlertType.BILLING_PAYMENT_DUE,
        severity: AlertSeverity.INFO,
        title: 'Upcoming payment',
        description: body,
      },
    });

    await this.notifications
      .sendPushToOrganization(subscription.organizationId, {
        title: 'Upcoming payment',
        body,
        url: '/settings/billing',
      })
      .catch((err) =>
        this.logger.warn(`Renewal push failed: ${this.errorMessage(err)}`),
      );

    const smsTo = subscription.mpesaPhone ?? organization?.phone;
    if (smsTo) {
      await this.africasTalking
        .sendSms(smsTo, body)
        .catch((err) =>
          this.logger.warn(`Renewal SMS failed: ${this.errorMessage(err)}`),
        );
    }

    await this.prisma.db.subscription.update({
      where: { id: subscription.id },
      data: { renewalReminderSentAt: now },
    });

    this.logger.log(
      `Renewal reminder sent for subscription ${subscription.id} (org ${subscription.organizationId})`,
    );
  }

  // ── Charge + retry ───────────────────────────────────────────────────────

  /** Entry point for the scheduled job. */
  async processDueSubscriptions(
    now = new Date(),
  ): Promise<MpesaRenewalRunResult> {
    const subscriptions = await this.prisma.db.subscription.findMany({
      where: {
        paymentMethod: SubscriptionPaymentMethod.MPESA,
        status: SubscriptionStatus.ACTIVE,
        nextRenewalDate: { not: null, lte: now },
      },
      include: { plan: true },
    });

    const result: MpesaRenewalRunResult = {
      processed: subscriptions.length,
      charged: 0,
      movedToGrace: 0,
    };

    for (const subscription of subscriptions) {
      const outcome = await this.processSubscription(subscription, now);
      if (outcome === 'charged') result.charged += 1;
      if (outcome === 'grace') result.movedToGrace += 1;
    }

    return result;
  }

  /**
   * One pass for one subscription: reconcile stale attempts, then either charge
   * the next retry, wait, or escalate to GRACE. Exposed for tests and for the
   * Phase F admin force-retry action.
   */
  async processSubscription(
    subscription: SubscriptionWithPlan,
    now = new Date(),
  ): Promise<MpesaSubscriptionOutcome> {
    const dueDate = subscription.nextRenewalDate;
    if (!dueDate) return 'skipped';

    const attempts = await this.prisma.db.paymentAttempt.findMany({
      where: {
        subscriptionId: subscription.id,
        method: SubscriptionPaymentMethod.MPESA,
        attemptedAt: { gte: dueDate },
      },
      orderBy: { attemptNumber: 'asc' },
    });

    const reconciled = await this.reconcileStaleAttempts(attempts, now);

    // Retries exhausted → GRACE (Section 7: day 0/2/4, then grace).
    if (reconciled.length >= MPESA_RETRY_OFFSETS_DAYS.length) {
      await this.moveToGrace(subscription, dueDate);
      return 'grace';
    }

    const offsetDays = MPESA_RETRY_OFFSETS_DAYS[reconciled.length];
    if (now < addDays(dueDate, offsetDays)) {
      return 'skipped';
    }

    const last = reconciled[reconciled.length - 1];
    if (
      last &&
      (last.status === PaymentAttemptStatus.PENDING ||
        last.status === PaymentAttemptStatus.SUCCESS)
    ) {
      // A prompt is outstanding, or a success is waiting on the webhook to
      // advance the cycle. Do not start a parallel charge.
      return 'waiting';
    }

    await this.charge(subscription, reconciled.length + 1, dueDate, now);
    return 'charged';
  }

  private async charge(
    subscription: SubscriptionWithPlan,
    attemptNumber: number,
    dueDate: Date,
    now: Date,
  ): Promise<void> {
    // Section 7 item 4: seats above the included allowance are auto-billed on
    // the next cycle rather than blocked. Rate is optional (F-12).
    const overageSeats = Math.max(
      0,
      subscription.seatCount - subscription.seatAllowance,
    );
    const overageRate = Number(subscription.plan.perSeatOverageKes ?? 0);
    const amountKes =
      Number(subscription.plan.priceKes) + overageSeats * overageRate;
    const reference = `HF-MPESA-${subscription.id}-${attemptNumber}-${randomUUID()}`;

    // Audit row first, exactly like RouterAction creates its action row before
    // touching the router — the attempt exists even if the API call never does.
    const attempt = await this.prisma.db.paymentAttempt.create({
      data: {
        organizationId: subscription.organizationId,
        subscriptionId: subscription.id,
        hisaflowPlanId: subscription.planId,
        amountKes,
        method: SubscriptionPaymentMethod.MPESA,
        paystackReference: reference,
        status: PaymentAttemptStatus.PENDING,
        attemptNumber,
      },
    });

    const email = await this.resolveBillingEmail(subscription.organizationId);
    if (!subscription.mpesaPhone) {
      await this.failAttempt(
        attempt.id,
        'No M-Pesa phone number on file',
        now,
      );
      return;
    }
    if (!email) {
      await this.failAttempt(attempt.id, 'No billing email on file', now);
      return;
    }

    try {
      const response = await this.paystack.chargeMobileMoney({
        email,
        amount: toSubunit(amountKes),
        currency: 'KES',
        phone: subscription.mpesaPhone,
        provider: MPESA_PROVIDER,
        reference,
        metadata: {
          organizationId: subscription.organizationId,
          subscriptionId: subscription.id,
          attemptNumber,
          renewalDue: dueDate.toISOString(),
        },
      });

      const chargeStatus = asString(response.data?.status)?.toLowerCase();
      if (chargeStatus === 'failed') {
        await this.failAttempt(
          attempt.id,
          asString(response.data?.display_text) ??
            'Paystack rejected the M-Pesa charge',
          now,
        );
        return;
      }

      if (chargeStatus === 'success') {
        // Uncommon for mobile money, but handle it rather than leaving the
        // subscription waiting for a webhook that will not come.
        await this.prisma.db.paymentAttempt.update({
          where: { id: attempt.id },
          data: { status: PaymentAttemptStatus.SUCCESS, resolvedAt: now },
        });
        await this.onRenewalPaid(subscription, dueDate, now);
        return;
      }

      // pay_offline / send_otp — STK prompt sent, wait for the webhook.
      this.logger.log(
        `M-Pesa charge attempt ${attemptNumber} sent for subscription ${subscription.id} (status=${chargeStatus ?? 'unknown'})`,
      );
    } catch (err) {
      await this.failAttempt(attempt.id, this.errorMessage(err), now);
    }
  }

  private async reconcileStaleAttempts(
    attempts: PaymentAttempt[],
    now: Date,
  ): Promise<PaymentAttempt[]> {
    const reconciled: PaymentAttempt[] = [];

    for (const attempt of attempts) {
      const isStale =
        attempt.status === PaymentAttemptStatus.PENDING &&
        now.getTime() - attempt.attemptedAt.getTime() >=
          MPESA_PENDING_TIMEOUT_MS;

      if (!isStale) {
        reconciled.push(attempt);
        continue;
      }

      const updated = await this.prisma.db.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: PaymentAttemptStatus.FAILED,
          errorMessage: 'Timed out waiting for M-Pesa confirmation',
          resolvedAt: now,
        },
      });
      reconciled.push(updated);
    }

    return reconciled;
  }

  private async moveToGrace(
    subscription: SubscriptionWithPlan,
    dueDate: Date,
  ): Promise<void> {
    const graceEndsAt = addDays(dueDate, GRACE_PERIOD_DAYS);
    const body = `We could not collect the ${subscription.plan.name} renewal after ${MPESA_RETRY_OFFSETS_DAYS.length} attempts. Access continues until ${this.formatDate(graceEndsAt)}.`;

    await this.prisma.db.subscription.update({
      where: { id: subscription.id },
      data: { status: SubscriptionStatus.GRACE, graceEndsAt },
    });

    await this.prisma.db.alert.create({
      data: {
        organizationId: subscription.organizationId,
        itemId: null,
        type: AlertType.BILLING_PAYMENT_DUE,
        severity: AlertSeverity.CRITICAL,
        title: 'Renewal payment failed',
        description: body,
      },
    });

    await this.notifications
      .sendPushToOrganization(subscription.organizationId, {
        title: 'Renewal payment failed',
        body,
        url: '/settings/billing',
      })
      .catch(() => undefined);

    this.logger.warn(
      `Subscription ${subscription.id} moved to GRACE until ${graceEndsAt.toISOString()}`,
    );
  }

  // ── Webhook outcomes ─────────────────────────────────────────────────────

  /** `charge.success` for a mobile_money charge. */
  async handleChargeSuccess(data: PaystackWebhookData): Promise<void> {
    const reference = asString(data.reference);
    const attempt = reference
      ? await this.prisma.db.paymentAttempt.findUnique({
          where: { paystackReference: reference },
        })
      : null;

    if (!attempt) {
      this.logger.warn(
        `M-Pesa charge.success ${reference ?? '(no ref)'}: no matching attempt`,
      );
      return;
    }

    // First cycle (paywall checkout) has no Subscription yet — create it.
    if (!attempt.subscriptionId) {
      await this.completeFirstCharge(attempt, data);
      return;
    }

    const subscription = await this.prisma.db.subscription.findUnique({
      where: { id: attempt.subscriptionId },
      include: { plan: true },
    });
    if (!subscription) {
      this.logger.warn(
        `M-Pesa charge.success ${reference ?? '(no ref)'}: no matching subscription`,
      );
      return;
    }

    const amountKes = this.amountKes(data);
    await this.prisma.db.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: PaymentAttemptStatus.SUCCESS,
        amountKes: amountKes ?? attempt.amountKes,
        errorMessage: null,
        resolvedAt: new Date(),
      },
    });

    await this.onRenewalPaid(
      subscription,
      subscription.nextRenewalDate ?? new Date(),
      new Date(),
    );
  }

  /**
   * First M-Pesa payment completed (via Paystack's checkout page). Creates the
   * Subscription that the scheduled renewal loop then owns.
   */
  private async completeFirstCharge(
    attempt: PaymentAttempt,
    data: PaystackWebhookData,
  ): Promise<void> {
    if (!attempt.hisaflowPlanId) {
      this.logger.warn(`M-Pesa first charge ${attempt.id}: attempt has no plan`);
      return;
    }

    const plan = await this.prisma.db.hisaflowPlan.findUnique({
      where: { id: attempt.hisaflowPlanId },
    });
    if (!plan) {
      this.logger.warn(
        `M-Pesa first charge ${attempt.id}: plan ${attempt.hisaflowPlanId} not found`,
      );
      return;
    }

    const now = new Date();
    const amountKes = this.amountKes(data);
    const mpesaPhone = getMpesaPhone(data);
    const existing = await this.prisma.db.subscription.findUnique({
      where: { organizationId: attempt.organizationId },
    });

    const subscription = existing
      ? await this.prisma.db.subscription.update({
          where: { id: existing.id },
          data: {
            planId: plan.id,
            seatAllowance: plan.seatAllowance,
            status: SubscriptionStatus.ACTIVE,
            paymentMethod: SubscriptionPaymentMethod.MPESA,
            mpesaPhone: mpesaPhone ?? existing.mpesaPhone,
            nextRenewalDate: addMonths(now, 1),
            renewalReminderSentAt: null,
            graceEndsAt: null,
          },
        })
      : await this.prisma.db.subscription.create({
          data: {
            organizationId: attempt.organizationId,
            planId: plan.id,
            seatCount: 1,
            seatAllowance: plan.seatAllowance,
            status: SubscriptionStatus.ACTIVE,
            paymentMethod: SubscriptionPaymentMethod.MPESA,
            mpesaPhone: mpesaPhone ?? null,
            nextRenewalDate: addMonths(now, 1),
            renewalReminderSentAt: null,
            graceEndsAt: null,
          },
        });

    await this.prisma.db.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: PaymentAttemptStatus.SUCCESS,
        subscriptionId: subscription.id,
        amountKes: amountKes ?? attempt.amountKes,
        errorMessage: null,
        resolvedAt: now,
      },
    });

    this.logger.log(
      `M-Pesa first charge completed for org ${attempt.organizationId}; subscription ${subscription.id}`,
    );
  }

  /** `charge.failed` for a mobile_money charge. */
  async handleChargeFailed(data: PaystackWebhookData): Promise<void> {
    const reference = asString(data.reference);
    const attempt = reference
      ? await this.prisma.db.paymentAttempt.findUnique({
          where: { paystackReference: reference },
        })
      : null;

    if (!attempt) {
      this.logger.warn(
        `M-Pesa charge.failed ${reference ?? '(no ref)'}: no matching attempt`,
      );
      return;
    }

    // Out-of-order delivery: a success already landed for this reference.
    if (attempt.status === PaymentAttemptStatus.SUCCESS) return;

    const message =
      asString(data.gateway_response) ??
      asString(data.message) ??
      'M-Pesa charge failed';

    await this.prisma.db.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: PaymentAttemptStatus.FAILED,
        errorMessage: message,
        resolvedAt: new Date(),
      },
    });

    // The subscription stays ACTIVE; the job retries at the next day-offset,
    // and only moves to GRACE once the retries are exhausted.
    this.logger.warn(
      `M-Pesa charge failed for subscription ${attempt.subscriptionId}: ${message}`,
    );
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async onRenewalPaid(
    subscription: SubscriptionWithPlan,
    dueDate: Date,
    now: Date,
  ): Promise<void> {
    await this.prisma.db.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        nextRenewalDate: addMonths(dueDate, 1),
        renewalReminderSentAt: null,
        graceEndsAt: null,
      },
    });

    await this.prisma.db.alert.updateMany({
      where: {
        organizationId: subscription.organizationId,
        type: AlertType.BILLING_PAYMENT_DUE,
        status: AlertStatus.UNRESOLVED,
      },
      data: { status: AlertStatus.RESOLVED, resolvedAt: now },
    });

    this.logger.log(
      `M-Pesa renewal succeeded for subscription ${subscription.id}; next due ${addMonths(dueDate, 1).toISOString()}`,
    );
  }

  private async failAttempt(
    id: string,
    message: string,
    now: Date,
  ): Promise<void> {
    await this.prisma.db.paymentAttempt.update({
      where: { id },
      data: {
        status: PaymentAttemptStatus.FAILED,
        errorMessage: message,
        resolvedAt: now,
      },
    });
    this.logger.warn(`M-Pesa attempt ${id} failed: ${message}`);
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

  private amountKes(data: PaystackWebhookData): number | undefined {
    const amount = asNumber(data.amount);
    return amount === undefined ? undefined : amount / 100;
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-KE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  private errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
