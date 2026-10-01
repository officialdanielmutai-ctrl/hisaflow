import {
  HisaflowPlan,
  PaymentAttempt,
  PaymentAttemptStatus,
  Subscription,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { CardSubscriptionService } from './card-subscription.service';

interface MockSeed {
  plan?: Partial<HisaflowPlan>;
  attempt?: Partial<PaymentAttempt> | null;
  subscription?: Partial<Subscription> | null;
  userEmail?: string;
  membershipOrganizationId?: string;
}

function createPrismaMock(seed: MockSeed = {}) {
  const plan = seed.plan
    ? ({
        id: 'plan_solo',
        tier: 'SOLO',
        name: 'Solo',
        description: null,
        priceKes: 2500,
        billingInterval: 'MONTHLY',
        seatAllowance: 1,
        paystackPlanCode: 'PLN_SOLO',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...seed.plan,
      } as unknown as HisaflowPlan)
    : null;

  let attempt = (seed.attempt === null
    ? null
    : ({
        id: 'att_1',
        organizationId: 'org_1',
        subscriptionId: null,
        hisaflowPlanId: plan?.id ?? null,
        amountKes: 2500,
        method: 'CARD',
        paystackReference: 'ref_first',
        status: 'PENDING',
        attemptNumber: 1,
        errorMessage: null,
        attemptedAt: new Date(),
        resolvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...(seed.attempt ?? {}),
      } as unknown as PaymentAttempt)) as PaymentAttempt | null;

  let subscription = (seed.subscription === null
    ? null
    : seed.subscription
      ? ({
          id: 'sub_1',
          organizationId: 'org_1',
          planId: plan?.id ?? 'plan_solo',
          seatCount: 1,
          seatAllowance: 1,
          status: 'ACTIVE',
          paymentMethod: 'CARD',
          nextRenewalDate: null,
          paystackSubscriptionCode: 'SUB_OLD',
          paystackCustomerCode: 'CUS_OLD',
          trialEndsAt: null,
          graceEndsAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...seed.subscription,
        } as unknown as Subscription)
      : null) as Subscription | null;

  const mock = {
    db: {
      paymentAttempt: {
        findUnique: async ({
          where,
        }: {
          where: { paystackReference: string };
        }): Promise<(PaymentAttempt & { plan: HisaflowPlan | null }) | null> => {
          if (!attempt || attempt.paystackReference !== where.paystackReference) {
            return null;
          }
          return { ...attempt, plan };
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }): Promise<PaymentAttempt | null> => {
          if (attempt && attempt.id === where.id) {
            attempt = { ...attempt, ...data } as PaymentAttempt;
          }
          return attempt;
        },
        upsert: async ({
          where,
          update,
          create,
        }: {
          where: { paystackReference: string };
          update: Record<string, unknown>;
          create: Record<string, unknown>;
        }): Promise<PaymentAttempt> => {
          if (attempt && attempt.paystackReference === where.paystackReference) {
            attempt = { ...attempt, ...update } as PaymentAttempt;
          } else {
            attempt = { id: 'att_new', ...create } as unknown as PaymentAttempt;
          }
          return attempt;
        },
      },
      subscription: {
        findUnique: async ({
          where,
        }: {
          where: { organizationId: string };
        }): Promise<Subscription | null> =>
          subscription && subscription.organizationId === where.organizationId
            ? subscription
            : null,
        findFirst: async ({
          where,
        }: {
          where: {
            paystackSubscriptionCode?: string;
            paystackCustomerCode?: string;
          };
        }): Promise<Subscription | null> => {
          if (!subscription) return null;
          if (
            where.paystackSubscriptionCode &&
            subscription.paystackSubscriptionCode ===
              where.paystackSubscriptionCode
          ) {
            return subscription;
          }
          if (
            where.paystackCustomerCode &&
            subscription.paystackCustomerCode === where.paystackCustomerCode
          ) {
            return subscription;
          }
          return null;
        },
        create: async ({
          data,
        }: {
          data: Record<string, unknown>;
        }): Promise<Subscription> => {
          subscription = {
            id: 'sub_new',
            ...data,
          } as unknown as Subscription;
          return subscription;
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }): Promise<Subscription | null> => {
          if (subscription && subscription.id === where.id) {
            subscription = { ...subscription, ...data } as Subscription;
          }
          return subscription;
        },
      },
      hisaflowPlan: {
        findFirst: async ({
          where,
        }: {
          where: { paystackPlanCode?: string };
        }): Promise<HisaflowPlan | null> =>
          plan && where.paystackPlanCode === plan.paystackPlanCode ? plan : null,
      },
      user: {
        findUnique: async ({
          where,
        }: {
          where: { email: string };
        }): Promise<{ id: string; email: string } | null> =>
          seed.userEmail === where.email
            ? { id: 'user_1', email: seed.userEmail }
            : null,
      },
      orgMembership: {
        findFirst: async (): Promise<{ organizationId: string } | null> =>
          seed.membershipOrganizationId
            ? { organizationId: seed.membershipOrganizationId }
            : null,
      },
    },
  };

  return {
    mock: mock as unknown as PrismaService,
    getAttempt: () => attempt,
    getSubscription: () => subscription,
  };
}

describe('CardSubscriptionService (Phase B)', () => {
  it('first charge creates an ACTIVE card subscription, links the attempt, and sets renewal date', async () => {
    const prisma = createPrismaMock({
      plan: { paystackPlanCode: 'PLN_SOLO' },
      attempt: { paystackReference: 'ref_first', status: 'PENDING' },
      subscription: null,
    });
    const service = new CardSubscriptionService(prisma.mock);

    await service.handleChargeSuccess({
      reference: 'ref_first',
      amount: 250000,
      channel: 'card',
      subscription: {
        subscription_code: 'SUB_NEW',
        next_payment_date: '2026-10-29T00:00:00.000Z',
      },
      customer: { customer_code: 'CUS_NEW', email: 'owner@example.com' },
    });

    const subscription = prisma.getSubscription();
    expect(subscription).not.toBeNull();
    expect(subscription?.status).toBe(SubscriptionStatus.ACTIVE);
    expect(subscription?.paymentMethod).toBe('CARD');
    expect(subscription?.paystackSubscriptionCode).toBe('SUB_NEW');
    expect(subscription?.paystackCustomerCode).toBe('CUS_NEW');
    expect(subscription?.nextRenewalDate?.toISOString()).toBe(
      '2026-10-29T00:00:00.000Z',
    );
    expect(subscription?.graceEndsAt).toBeNull();

    const attempt = prisma.getAttempt();
    expect(attempt?.status).toBe(PaymentAttemptStatus.SUCCESS);
    expect(attempt?.subscriptionId).toBe(subscription?.id);
  });

  it('renewal charge reactivates a GRACE subscription and clears the grace window', async () => {
    const prisma = createPrismaMock({
      plan: { paystackPlanCode: 'PLN_SOLO' },
      attempt: null,
      subscription: {
        status: SubscriptionStatus.GRACE,
        graceEndsAt: new Date('2026-09-25T00:00:00.000Z'),
        paystackSubscriptionCode: 'SUB_1',
      },
    });
    const service = new CardSubscriptionService(prisma.mock);

    await service.handleChargeSuccess({
      reference: 'ref_renewal',
      amount: 250000,
      channel: 'card',
      plan: { plan_code: 'PLN_SOLO' },
      subscription: {
        subscription_code: 'SUB_1',
        next_payment_date: '2026-11-01T00:00:00.000Z',
      },
      customer: { customer_code: 'CUS_1' },
    });

    const subscription = prisma.getSubscription();
    expect(subscription?.status).toBe(SubscriptionStatus.ACTIVE);
    expect(subscription?.graceEndsAt).toBeNull();
    expect(subscription?.nextRenewalDate?.toISOString()).toBe(
      '2026-11-01T00:00:00.000Z',
    );

    // A Paystack-initiated auto-renewal has no pre-created attempt row.
    const attempt = prisma.getAttempt();
    expect(attempt?.status).toBe(PaymentAttemptStatus.SUCCESS);
    expect(attempt?.paystackReference).toBe('ref_renewal');
    expect(attempt?.subscriptionId).toBe(subscription?.id);
  });

  it('invoice.payment_failed moves the org to GRACE for 5 days and logs a FAILED attempt', async () => {
    const prisma = createPrismaMock({
      subscription: {
        status: SubscriptionStatus.ACTIVE,
        paystackSubscriptionCode: 'SUB_1',
        organizationId: 'org_1',
      },
    });
    const service = new CardSubscriptionService(prisma.mock);

    const before = Date.now();
    await service.handleInvoicePaymentFailed({
      reference: 'ref_failed_renewal',
      amount: 250000,
      subscription: { subscription_code: 'SUB_1' },
      customer: { customer_code: 'CUS_1' },
    });

    const subscription = prisma.getSubscription();
    expect(subscription?.status).toBe(SubscriptionStatus.GRACE);
    const daysUntilLockout = Math.round(
      (subscription!.graceEndsAt!.getTime() - before) / 86_400_000,
    );
    expect(daysUntilLockout).toBe(5);

    const attempt = prisma.getAttempt();
    expect(attempt?.status).toBe(PaymentAttemptStatus.FAILED);
    expect(attempt?.paystackReference).toBe('ref_failed_renewal');
    expect(attempt?.subscriptionId).toBe(subscription?.id);
  });

  it('subscription.create links the Paystack subscription code to the org row', async () => {
    const prisma = createPrismaMock({
      plan: { paystackPlanCode: 'PLN_SOLO' },
      subscription: {
        organizationId: 'org_1',
        paystackSubscriptionCode: null,
        paystackCustomerCode: null,
      },
      userEmail: 'owner@example.com',
      membershipOrganizationId: 'org_1',
    });
    const service = new CardSubscriptionService(prisma.mock);

    await service.handleSubscriptionCreate({
      subscription_code: 'SUB_CREATED',
      plan: { plan_code: 'PLN_SOLO' },
      customer: { customer_code: 'CUS_1', email: 'owner@example.com' },
      next_payment_date: '2026-11-15T00:00:00.000Z',
    });

    const subscription = prisma.getSubscription();
    expect(subscription?.paystackSubscriptionCode).toBe('SUB_CREATED');
    expect(subscription?.status).toBe(SubscriptionStatus.ACTIVE);
    expect(subscription?.nextRenewalDate?.toISOString()).toBe(
      '2026-11-15T00:00:00.000Z',
    );
  });

  it('does not throw when the organization cannot be resolved', async () => {
    const prisma = createPrismaMock({ attempt: null, subscription: null });
    const service = new CardSubscriptionService(prisma.mock);

    await expect(
      service.handleChargeSuccess({ reference: 'ref_orphan', amount: 250000 }),
    ).resolves.toBeUndefined();
    expect(prisma.getSubscription()).toBeNull();
  });
});
