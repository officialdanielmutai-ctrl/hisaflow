import {
  PaymentAttemptStatus,
  SubscriptionPaymentMethod,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AfricasTalkingProvider } from '../../../infrastructure/providers/africas-talking.provider';
import { NotificationsService } from '../../notifications/notifications.service';
import { PaystackService } from '../paystack/paystack.service';
import {
  ChargeMobileMoneyInput,
  PaystackApiResponse,
  PaystackChargeResult,
} from '../paystack/paystack.types';
import {
  GRACE_PERIOD_DAYS,
  MpesaRenewalService,
} from './mpesa-renewal.service';

const DAY = 86_400_000;
const DUE = new Date('2026-09-10T09:00:00.000Z');

interface PlanRow {
  id: string;
  tier: string;
  name: string;
  priceKes: number;
  seatAllowance: number;
  paystackPlanCode: string | null;
  isActive: boolean;
}

interface SubRow {
  id: string;
  organizationId: string;
  planId: string;
  status: SubscriptionStatus;
  paymentMethod: SubscriptionPaymentMethod;
  mpesaPhone: string | null;
  renewalReminderSentAt: Date | null;
  nextRenewalDate: Date | null;
  graceEndsAt: Date | null;
}

interface AttemptRow {
  id: string;
  organizationId: string;
  subscriptionId: string | null;
  hisaflowPlanId: string | null;
  amountKes: number;
  method: SubscriptionPaymentMethod;
  paystackReference: string | null;
  status: PaymentAttemptStatus;
  attemptNumber: number;
  errorMessage: string | null;
  attemptedAt: Date;
  resolvedAt: Date | null;
}

interface AlertRow {
  id: string;
  organizationId: string;
  type: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  resolvedAt: Date | null;
}

interface SubscriptionWhere {
  paymentMethod?: SubscriptionPaymentMethod;
  status?: SubscriptionStatus;
  renewalReminderSentAt?: null;
  nextRenewalDate?: { not?: null; gte?: Date; lte?: Date };
}

interface AttemptWhere {
  subscriptionId?: string;
  method?: SubscriptionPaymentMethod;
  attemptedAt?: { gte?: Date };
}

interface AlertWhere {
  organizationId?: string;
  type?: string;
  status?: string;
}

function createPrismaMock(seed: {
  plan?: Partial<PlanRow>;
  subscription?: Partial<SubRow>;
  attempts?: Partial<AttemptRow>[];
}) {
  const plan: PlanRow = {
    id: 'plan_solo',
    tier: 'SOLO',
    name: 'Solo',
    priceKes: 2500,
    seatAllowance: 1,
    paystackPlanCode: 'PLN_SOLO',
    isActive: true,
    ...seed.plan,
  };
  const subscription: SubRow = {
    id: 'sub_1',
    organizationId: 'org_1',
    planId: plan.id,
    status: SubscriptionStatus.ACTIVE,
    paymentMethod: SubscriptionPaymentMethod.MPESA,
    mpesaPhone: '+254700000000',
    renewalReminderSentAt: null,
    nextRenewalDate: DUE,
    graceEndsAt: null,
    ...seed.subscription,
  };
  const attempts: AttemptRow[] = (seed.attempts ?? []).map((a, index) => ({
    id: `att_seed_${index + 1}`,
    organizationId: 'org_1',
    subscriptionId: subscription.id,
    hisaflowPlanId: plan.id,
    amountKes: 2500,
    method: SubscriptionPaymentMethod.MPESA,
    paystackReference: `ref_seed_${index + 1}`,
    status: PaymentAttemptStatus.PENDING,
    attemptNumber: index + 1,
    errorMessage: null,
    attemptedAt: DUE,
    resolvedAt: null,
    ...a,
  }));
  const alerts: AlertRow[] = [];
  let sequence = 0;

  const mock = {
    db: {
      subscription: {
        findMany: async ({
          where = {},
          include,
        }: {
          where?: SubscriptionWhere;
          include?: { plan?: boolean };
        } = {}) => {
          const rows = [subscription].filter((s) => matchesSubscription(s, where));
          return rows.map((s) =>
            include?.plan ? { ...s, plan } : { ...s },
          );
        },
        findUnique: async ({
          where,
          include,
        }: {
          where: { id: string };
          include?: { plan?: boolean };
        }) => {
          if (subscription.id !== where.id) return null;
          return include?.plan ? { ...subscription, plan } : { ...subscription };
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<SubRow>;
        }) => {
          if (subscription.id !== where.id) throw new Error('missing sub');
          Object.assign(subscription, data);
          return { ...subscription, plan };
        },
      },
      paymentAttempt: {
        findMany: async ({
          where = {},
          orderBy,
        }: {
          where?: AttemptWhere;
          orderBy?: { attemptNumber?: 'asc' | 'desc' };
        } = {}) => {
          const rows = attempts.filter((a) => matchesAttempt(a, where));
          if (orderBy?.attemptNumber === 'asc') {
            rows.sort((a, b) => a.attemptNumber - b.attemptNumber);
          }
          return rows.map((a) => ({ ...a }));
        },
        findUnique: async ({
          where,
        }: {
          where: { paystackReference: string };
        }) => {
          const found = attempts.find(
            (a) => a.paystackReference === where.paystackReference,
          );
          return found ? { ...found } : null;
        },
        create: async ({ data }: { data: Partial<AttemptRow> }) => {
          const row: AttemptRow = {
            id: `att_${++sequence}`,
            organizationId: 'org_1',
            subscriptionId: subscription.id,
            hisaflowPlanId: plan.id,
            amountKes: 2500,
            method: SubscriptionPaymentMethod.MPESA,
            paystackReference: null,
            status: PaymentAttemptStatus.PENDING,
            attemptNumber: 1,
            errorMessage: null,
            attemptedAt: new Date(),
            resolvedAt: null,
            ...data,
          };
          attempts.push(row);
          return { ...row };
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<AttemptRow>;
        }) => {
          const row = attempts.find((a) => a.id === where.id);
          if (!row) throw new Error('missing attempt');
          Object.assign(row, data);
          return { ...row };
        },
      },
      organization: {
        findUnique: async () => ({ name: 'Test Org', phone: '+254711111111' }),
      },
      orgMembership: {
        findFirst: async () => ({
          user: { id: 'user_1', email: 'owner@example.com' },
        }),
      },
      alert: {
        create: async ({ data }: { data: Partial<AlertRow> }) => {
          const row: AlertRow = {
            id: `alert_${++sequence}`,
            organizationId: 'org_1',
            type: 'BILLING_PAYMENT_DUE',
            severity: 'INFO',
            status: 'UNRESOLVED',
            title: '',
            description: '',
            resolvedAt: null,
            ...data,
          };
          alerts.push(row);
          return row;
        },
        updateMany: async ({
          where,
          data,
        }: {
          where: AlertWhere;
          data: Partial<AlertRow>;
        }) => {
          let count = 0;
          for (const alert of alerts) {
            if (
              (!where.organizationId ||
                alert.organizationId === where.organizationId) &&
              (!where.type || alert.type === where.type) &&
              (!where.status || alert.status === where.status)
            ) {
              Object.assign(alert, data);
              count += 1;
            }
          }
          return { count };
        },
      },
    },
  };

  return {
    mock: mock as unknown as PrismaService,
    getSubscription: () => subscription,
    getAttempts: () => attempts,
    getAlerts: () => alerts,
  };
}

function matchesSubscription(
  sub: SubRow,
  where: SubscriptionWhere,
): boolean {
  if (where.paymentMethod && sub.paymentMethod !== where.paymentMethod) {
    return false;
  }
  if (where.status && sub.status !== where.status) return false;
  if (where.renewalReminderSentAt === null && sub.renewalReminderSentAt !== null) {
    return false;
  }
  if (where.nextRenewalDate) {
    const cond = where.nextRenewalDate;
    if (cond.not === null && sub.nextRenewalDate === null) return false;
    if (cond.gte && (!sub.nextRenewalDate || sub.nextRenewalDate < cond.gte)) {
      return false;
    }
    if (cond.lte && (!sub.nextRenewalDate || sub.nextRenewalDate > cond.lte)) {
      return false;
    }
  }
  return true;
}

function matchesAttempt(
  attempt: AttemptRow,
  where: AttemptWhere,
): boolean {
  if (where.subscriptionId && attempt.subscriptionId !== where.subscriptionId) {
    return false;
  }
  if (where.method && attempt.method !== where.method) return false;
  if (
    where.attemptedAt?.gte &&
    attempt.attemptedAt.getTime() < where.attemptedAt.gte.getTime()
  ) {
    return false;
  }
  return true;
}

function build(seed: Parameters<typeof createPrismaMock>[0] = {}) {
  const prisma = createPrismaMock(seed);
  const paystack = {
    chargeMobileMoney: jest.fn(
      async (
        input: ChargeMobileMoneyInput,
      ): Promise<PaystackApiResponse<PaystackChargeResult>> => ({
        status: true,
        message: 'ok',
        data: { status: 'pay_offline', reference: input.reference },
      }),
    ),
  };
  const notifications = {
    sendPushToOrganization: jest.fn(async () => undefined),
  };
  const sms = { sendSms: jest.fn(async () => undefined) };

  const service = new MpesaRenewalService(
    prisma.mock,
    paystack as unknown as PaystackService,
    notifications as unknown as NotificationsService,
    sms as unknown as AfricasTalkingProvider,
  );

  return { prisma, paystack, notifications, sms, service };
}

describe('MpesaRenewalService (Phase C)', () => {
  it('sends exactly one reminder per cycle for a subscription approaching its due date', async () => {
    const { service, prisma, notifications, sms } = build({
      subscription: { nextRenewalDate: new Date(DUE.getTime() - 2 * DAY) },
    });
    const now = new Date(DUE.getTime() - 2 * DAY);

    const sent = await service.sendDueReminders(now);
    expect(sent).toBe(1);
    expect(prisma.getAlerts()).toHaveLength(1);
    expect(notifications.sendPushToOrganization).toHaveBeenCalledTimes(1);
    expect(sms.sendSms).toHaveBeenCalledTimes(1);
    expect(prisma.getSubscription().renewalReminderSentAt).not.toBeNull();

    // Second run in the same cycle must not remind twice.
    const second = await service.sendDueReminders(now);
    expect(second).toBe(0);
    expect(prisma.getAlerts()).toHaveLength(1);
  });

  it('charges on the due date with the mobile_money channel and phone number', async () => {
    const { service, prisma, paystack } = build();

    const result = await service.processDueSubscriptions(DUE);

    expect(result.charged).toBe(1);
    const attempts = prisma.getAttempts();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].attemptNumber).toBe(1);
    expect(attempts[0].method).toBe(SubscriptionPaymentMethod.MPESA);
    expect(attempts[0].status).toBe(PaymentAttemptStatus.PENDING);

    expect(paystack.chargeMobileMoney).toHaveBeenCalledTimes(1);
    const input = paystack.chargeMobileMoney.mock.calls[0][0] as {
      phone: string;
      provider: string;
    };
    expect(input.phone).toBe('+254700000000');
    expect(input.provider).toBe('mpesa');
  });

  it('does not charge before the due date', async () => {
    const { service, paystack } = build({
      subscription: { nextRenewalDate: new Date(DUE.getTime() + DAY) },
    });

    await service.processDueSubscriptions(DUE);

    expect(paystack.chargeMobileMoney).not.toHaveBeenCalled();
  });

  it('a deliberately failed prompt retries exactly 3 times (day 0/2/4) then moves to GRACE', async () => {
    const { service, prisma, paystack } = build();
    paystack.chargeMobileMoney.mockRejectedValue(
      new Error('Prompt cancelled by customer'),
    );

    // Day 0 — first attempt.
    await service.processDueSubscriptions(DUE);
    expect(prisma.getAttempts()).toHaveLength(1);
    expect(prisma.getSubscription().status).toBe(SubscriptionStatus.ACTIVE);

    // Day 1 — not yet time for the next offset.
    await service.processDueSubscriptions(new Date(DUE.getTime() + DAY));
    expect(prisma.getAttempts()).toHaveLength(1);

    // Day 2 — second attempt.
    await service.processDueSubscriptions(new Date(DUE.getTime() + 2 * DAY));
    expect(prisma.getAttempts()).toHaveLength(2);

    // Day 4 — third and final attempt.
    await service.processDueSubscriptions(new Date(DUE.getTime() + 4 * DAY));
    expect(prisma.getAttempts()).toHaveLength(3);
    expect(prisma.getAttempts().every((a) => a.status === PaymentAttemptStatus.FAILED)).toBe(true);
    // Not an immediate hard lockout — still ACTIVE before the next run.
    expect(prisma.getSubscription().status).toBe(SubscriptionStatus.ACTIVE);

    // Retries exhausted — GRACE, not silent lapse.
    await service.processDueSubscriptions(new Date(DUE.getTime() + 4 * DAY + 60_000));
    expect(prisma.getAttempts()).toHaveLength(3);
    expect(prisma.getSubscription().status).toBe(SubscriptionStatus.GRACE);

    const graceDays = Math.round(
      (prisma.getSubscription().graceEndsAt!.getTime() - DUE.getTime()) / DAY,
    );
    expect(graceDays).toBe(GRACE_PERIOD_DAYS);
  });

  it('treats a failed Charge API response as a failed attempt', async () => {
    const { service, prisma, paystack } = build();
    paystack.chargeMobileMoney.mockResolvedValue({
      status: false,
      message: 'Charge failed',
      data: { status: 'failed', display_text: 'Insufficient funds' },
    });

    await service.processDueSubscriptions(DUE);

    expect(prisma.getAttempts()).toHaveLength(1);
    expect(prisma.getAttempts()[0].status).toBe(PaymentAttemptStatus.FAILED);
    expect(prisma.getAttempts()[0].errorMessage).toBe('Insufficient funds');
  });

  it('reconciles a stale PENDING attempt before scheduling the next retry', async () => {
    const now = new Date(DUE.getTime() + DAY);
    const { service, prisma } = build({
      attempts: [
        {
          attemptedAt: new Date(now.getTime() - 60 * 60 * 1000),
          status: PaymentAttemptStatus.PENDING,
        },
      ],
    });

    await service.processDueSubscriptions(now);

    expect(prisma.getAttempts()[0].status).toBe(PaymentAttemptStatus.FAILED);
    expect(prisma.getAttempts()[0].errorMessage).toContain('Timed out');
  });

  it('marks a success webhook paid: attempt SUCCESS and the cycle advances one month', async () => {
    const { service, prisma } = build({
      attempts: [
        {
          paystackReference: 'ref_paid',
          status: PaymentAttemptStatus.PENDING,
          attemptNumber: 1,
        },
      ],
    });

    await service.handleChargeSuccess({
      reference: 'ref_paid',
      amount: 250000,
      channel: 'mobile_money',
    });

    expect(prisma.getAttempts()[0].status).toBe(PaymentAttemptStatus.SUCCESS);
    const subscription = prisma.getSubscription();
    expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
    expect(subscription.renewalReminderSentAt).toBeNull();
    expect(subscription.graceEndsAt).toBeNull();
    expect(subscription.nextRenewalDate?.getUTCMonth()).toBe(
      (DUE.getUTCMonth() + 1) % 12,
    );
  });

  it('marks a failure webhook FAILED without moving to GRACE immediately', async () => {
    const { service, prisma } = build({
      attempts: [
        {
          paystackReference: 'ref_failed',
          status: PaymentAttemptStatus.PENDING,
        },
      ],
    });

    await service.handleChargeFailed({
      reference: 'ref_failed',
      channel: 'mobile_money',
      gateway_response: 'Request cancelled by customer',
    });

    expect(prisma.getAttempts()[0].status).toBe(PaymentAttemptStatus.FAILED);
    expect(prisma.getAttempts()[0].errorMessage).toContain('cancelled');
    expect(prisma.getSubscription().status).toBe(SubscriptionStatus.ACTIVE);
  });

  it('records a failed attempt when no M-Pesa phone is on file', async () => {
    const { service, prisma, paystack } = build({
      subscription: { mpesaPhone: null },
    });

    await service.processDueSubscriptions(DUE);

    expect(paystack.chargeMobileMoney).not.toHaveBeenCalled();
    expect(prisma.getAttempts()).toHaveLength(1);
    expect(prisma.getAttempts()[0].status).toBe(PaymentAttemptStatus.FAILED);
    expect(prisma.getAttempts()[0].errorMessage).toContain('phone');
  });
});
