import { BadRequestException } from '@nestjs/common';
import {
  HisaflowPlan,
  HisaflowPlanTier,
  PaymentAttemptStatus,
  Subscription,
  SubscriptionPaymentMethod,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { FeatureLockedException } from '../../../core/entitlements/feature-locked.exception';
import { PaystackService } from '../paystack/paystack.service';
import { HisaflowPlansService } from '../plans/hisaflow-plans.service';
import { CardCheckoutService } from './card-checkout.service';
import { MpesaCheckoutService } from './mpesa-checkout.service';
import { BillingService } from './billing.service';

function makePlan(overrides: Record<string, unknown> = {}): HisaflowPlan {
  return {
    id: 'plan_solo',
    tier: 'SOLO',
    name: 'Solo',
    description: null,
    priceKes: 2500,
    billingInterval: 'MONTHLY',
    seatAllowance: 1,
    perSeatOverageKes: null,
    paystackPlanCode: 'PLN_SOLO',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as HisaflowPlan;
}

function makeSubscription(
  plan: HisaflowPlan,
  overrides: Partial<Subscription> = {},
): Subscription & { plan: HisaflowPlan } {
  return {
    id: 'sub_1',
    organizationId: 'org_1',
    planId: plan.id,
    seatCount: 1,
    seatAllowance: plan.seatAllowance,
    status: SubscriptionStatus.ACTIVE,
    paymentMethod: SubscriptionPaymentMethod.CARD,
    mpesaPhone: null,
    renewalReminderSentAt: null,
    nextRenewalDate: new Date('2026-10-15T00:00:00.000Z'),
    paystackSubscriptionCode: 'SUB_OLD',
    paystackCustomerCode: 'CUS_1',
    pendingTier: null,
    pendingPlanEffectiveAt: null,
    trialEndsAt: null,
    graceEndsAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    plan,
    ...overrides,
  } as unknown as Subscription & { plan: HisaflowPlan };
}

interface BillingMocks {
  service: BillingService;
  prisma: {
    subscriptionFindUnique: jest.Mock;
    subscriptionUpdate: jest.Mock;
    subscriptionFindMany: jest.Mock;
    membershipCount: jest.Mock;
    attemptFindMany: jest.Mock;
  };
  paystack: {
    disableSubscription: jest.Mock;
    createSubscription: jest.Mock;
    generateUpdateSubscriptionLink: jest.Mock;
    fetchCustomer: jest.Mock;
    listTransactions: jest.Mock;
  };
  plans: {
    findByTier: jest.Mock;
    ensurePaystackPlanCode: jest.Mock;
  };
  cardCheckout: { start: jest.Mock };
  mpesaCheckout: { start: jest.Mock };
}

function build(seed: {
  subscription?: (Subscription & { plan: HisaflowPlan }) | null;
  plans?: Record<HisaflowPlanTier, HisaflowPlan>;
}): BillingMocks {
  const subscriptionUpdate = jest.fn(async ({ data }) => ({
    ...(seed.subscription ?? {}),
    ...data,
  }));
  const subscriptionFindUnique = jest.fn(async () => seed.subscription ?? null);
  const subscriptionFindMany = jest.fn(async () => []);
  const membershipCount = jest.fn(async () => 1);
  const attemptFindMany = jest.fn(async () => []);

  const prisma = {
    db: {
      subscription: {
        findUnique: subscriptionFindUnique,
        update: subscriptionUpdate,
        findMany: subscriptionFindMany,
      },
      orgMembership: { count: membershipCount },
      paymentAttempt: { findMany: attemptFindMany },
    },
  };

  const planMap = seed.plans ?? { SOLO: makePlan() };

  const paystack = {
    disableSubscription: jest.fn(async () => ({
      status: true,
      message: 'ok',
      data: {},
    })),
    createSubscription: jest.fn(async () => ({
      status: true,
      message: 'ok',
      data: { subscription_code: 'SUB_NEW' },
    })),
    generateUpdateSubscriptionLink: jest.fn(async () => ({
      status: true,
      message: 'ok',
      data: { link: 'https://paystack.com/manage/SUB_OLD' },
    })),
    // Default to "Paystack unavailable" so receipt tests exercise the
    // documented fallback to the local audit trail unless they opt in.
    fetchCustomer: jest.fn(async () => {
      throw new Error('PAYSTACK_SECRET_KEY is not configured');
    }),
    listTransactions: jest.fn(async () => ({
      status: true,
      message: 'ok',
      data: [] as unknown[],
    })),
  };

  const plans = {
    findByTier: jest.fn(async (tier: HisaflowPlanTier) => planMap[tier] ?? null),
    ensurePaystackPlanCode: jest.fn(async (plan: HisaflowPlan) =>
      plan.paystackPlanCode ?? `PLN_${plan.tier}`,
    ),
  };

  const cardCheckout = {
    start: jest.fn(async () => ({
      authorizationUrl: 'https://checkout.paystack.com/card',
      accessCode: 'acc_card',
      reference: 'HF-TEAM-ref',
      tier: 'TEAM' as HisaflowPlanTier,
      amountKes: 5500,
    })),
  };
  const mpesaCheckout = {
    start: jest.fn(async () => ({
      authorizationUrl: 'https://checkout.paystack.com/mpesa',
      accessCode: 'acc_mpesa',
      reference: 'HF-MPESA-ref',
      tier: 'TEAM' as HisaflowPlanTier,
      amountKes: 5500,
    })),
  };

  const service = new BillingService(
    prisma as unknown as PrismaService,
    paystack as unknown as PaystackService,
    plans as unknown as HisaflowPlansService,
    cardCheckout as unknown as CardCheckoutService,
    mpesaCheckout as unknown as MpesaCheckoutService,
  );

  return {
    service,
    prisma: {
      subscriptionFindUnique,
      subscriptionUpdate,
      subscriptionFindMany,
      membershipCount,
      attemptFindMany,
    },
    paystack,
    plans,
    cardCheckout,
    mpesaCheckout,
  };
}

describe('BillingService (Phase E)', () => {
  describe('changePlan — upgrade is immediate', () => {
    it('disables the old card subscription and starts a new checkout on the higher tier', async () => {
      const solo = makePlan();
      const team = makePlan({
        id: 'plan_team',
        tier: 'TEAM',
        name: 'Team',
        priceKes: 5500,
        seatAllowance: 3,
        paystackPlanCode: 'PLN_TEAM',
      });
      const sub = makeSubscription(solo);
      const mocks = build({
        subscription: sub,
        plans: { SOLO: solo, TEAM: team } as Record<
          HisaflowPlanTier,
          HisaflowPlan
        >,
      });

      const result = await mocks.service.changePlan('org_1', 'TEAM');

      expect(result.mode).toBe('immediate');
      expect(result.action).toBe('checkout');
      expect(result.authorizationUrl).toBe(
        'https://checkout.paystack.com/card',
      );
      // disable-old/create-new: the old Paystack subscription is cancelled
      // before a fresh checkout is created.
      expect(mocks.paystack.disableSubscription).toHaveBeenCalledWith('SUB_OLD');
      expect(mocks.cardCheckout.start).toHaveBeenCalledWith({
        organizationId: 'org_1',
        tier: 'TEAM',
      });
      // An upgrade supersedes any pending downgrade.
      expect(mocks.prisma.subscriptionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { pendingTier: null, pendingPlanEffectiveAt: null },
        }),
      );
    });

    it('starts an M-Pesa checkout for an M-Pesa org (no card subscription to disable)', async () => {
      const solo = makePlan();
      const team = makePlan({
        id: 'plan_team',
        tier: 'TEAM',
        name: 'Team',
        priceKes: 5500,
        seatAllowance: 3,
        paystackPlanCode: 'PLN_TEAM',
      });
      const sub = makeSubscription(solo, {
        paymentMethod: SubscriptionPaymentMethod.MPESA,
        mpesaPhone: '+254712345678',
        paystackSubscriptionCode: null,
      });
      const mocks = build({
        subscription: sub,
        plans: { SOLO: solo, TEAM: team } as Record<
          HisaflowPlanTier,
          HisaflowPlan
        >,
      });

      const result = await mocks.service.changePlan('org_1', 'TEAM');

      expect(result.mode).toBe('immediate');
      expect(result.method).toBe(SubscriptionPaymentMethod.MPESA);
      expect(mocks.mpesaCheckout.start).toHaveBeenCalledWith({
        organizationId: 'org_1',
        tier: 'TEAM',
        mpesaPhone: '+254712345678',
      });
      expect(mocks.paystack.disableSubscription).not.toHaveBeenCalled();
    });
  });

  describe('changePlan — downgrade is deferred to renewal', () => {
    it('schedules the lower tier for the next renewal without changing the plan now', async () => {
      const team = makePlan({
        id: 'plan_team',
        tier: 'TEAM',
        name: 'Team',
        priceKes: 5500,
        seatAllowance: 3,
        paystackPlanCode: 'PLN_TEAM',
      });
      const solo = makePlan({ id: 'plan_solo', isActive: true });
      const sub = makeSubscription(team);
      const mocks = build({
        subscription: sub,
        plans: { SOLO: solo, TEAM: team } as Record<
          HisaflowPlanTier,
          HisaflowPlan
        >,
      });

      const result = await mocks.service.changePlan('org_1', 'SOLO');

      expect(result.mode).toBe('scheduled');
      expect(result.effectiveAt).toBe(sub.nextRenewalDate?.toISOString());
      expect(mocks.prisma.subscriptionUpdate).toHaveBeenCalledWith({
        where: { id: 'sub_1' },
        data: {
          pendingTier: 'SOLO',
          pendingPlanEffectiveAt: sub.nextRenewalDate,
        },
      });
      // Deferred: nothing is disabled or charged at scheduling time, and the
      // current plan is untouched.
      expect(mocks.paystack.disableSubscription).not.toHaveBeenCalled();
      expect(mocks.cardCheckout.start).not.toHaveBeenCalled();
      expect(mocks.mpesaCheckout.start).not.toHaveBeenCalled();
    });

    it('rejects a no-op change', async () => {
      const solo = makePlan();
      const mocks = build({
        subscription: makeSubscription(solo),
        plans: { SOLO: solo } as Record<HisaflowPlanTier, HisaflowPlan>,
      });
      await expect(mocks.service.changePlan('org_1', 'SOLO')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('applyDuePlanChanges — deferred downgrade application', () => {
    it('does not apply a downgrade before its effective date', async () => {
      const team = makePlan({
        id: 'plan_team',
        tier: 'TEAM',
        seatAllowance: 3,
      });
      const solo = makePlan({ id: 'plan_solo' });
      const sub = makeSubscription(team, {
        pendingTier: 'SOLO',
        pendingPlanEffectiveAt: new Date('2026-11-01T00:00:00.000Z'),
      });
      const mocks = build({
        subscription: sub,
        plans: { SOLO: solo, TEAM: team } as Record<
          HisaflowPlanTier,
          HisaflowPlan
        >,
      });
      mocks.prisma.subscriptionFindMany.mockResolvedValueOnce([]);

      const result = await mocks.service.applyDuePlanChanges(
        new Date('2026-10-20T00:00:00.000Z'),
      );

      expect(result).toEqual({ processed: 0, applied: 0 });
      expect(mocks.prisma.subscriptionUpdate).not.toHaveBeenCalled();
    });

    it('applies a card downgrade by disabling the old subscription and creating the lower one', async () => {
      const team = makePlan({
        id: 'plan_team',
        tier: 'TEAM',
        seatAllowance: 3,
        paystackPlanCode: 'PLN_TEAM',
      });
      const solo = makePlan({ id: 'plan_solo', paystackPlanCode: 'PLN_SOLO' });
      const sub = makeSubscription(team, {
        pendingTier: 'SOLO',
        pendingPlanEffectiveAt: new Date('2026-10-15T00:00:00.000Z'),
      });
      const mocks = build({
        subscription: sub,
        plans: { SOLO: solo, TEAM: team } as Record<
          HisaflowPlanTier,
          HisaflowPlan
        >,
      });
      mocks.prisma.subscriptionFindMany.mockResolvedValueOnce([sub]);

      const result = await mocks.service.applyDuePlanChanges(
        new Date('2026-10-15T00:00:00.000Z'),
      );

      expect(result).toEqual({ processed: 1, applied: 1 });
      expect(mocks.paystack.disableSubscription).toHaveBeenCalledWith('SUB_OLD');
      expect(mocks.paystack.createSubscription).toHaveBeenCalledWith({
        customer: 'CUS_1',
        plan: 'PLN_SOLO',
      });
      expect(mocks.prisma.subscriptionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub_1' },
          data: expect.objectContaining({
            planId: 'plan_solo',
            seatAllowance: 1,
            pendingTier: null,
            pendingPlanEffectiveAt: null,
          }),
        }),
      );
    });

    it('applies an M-Pesa downgrade locally without touching Paystack', async () => {
      const team = makePlan({
        id: 'plan_team',
        tier: 'TEAM',
        seatAllowance: 3,
      });
      const solo = makePlan({ id: 'plan_solo' });
      const sub = makeSubscription(team, {
        paymentMethod: SubscriptionPaymentMethod.MPESA,
        mpesaPhone: '+254712345678',
        paystackSubscriptionCode: null,
        pendingTier: 'SOLO',
        pendingPlanEffectiveAt: new Date('2026-10-15T00:00:00.000Z'),
      });
      const mocks = build({
        subscription: sub,
        plans: { SOLO: solo, TEAM: team } as Record<
          HisaflowPlanTier,
          HisaflowPlan
        >,
      });
      mocks.prisma.subscriptionFindMany.mockResolvedValueOnce([sub]);

      const result = await mocks.service.applyDuePlanChanges(
        new Date('2026-10-15T00:00:00.000Z'),
      );

      expect(result).toEqual({ processed: 1, applied: 1 });
      expect(mocks.paystack.disableSubscription).not.toHaveBeenCalled();
      expect(mocks.paystack.createSubscription).not.toHaveBeenCalled();
      expect(mocks.prisma.subscriptionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ planId: 'plan_solo' }),
        }),
      );
    });
  });

  describe('updateSeats', () => {
    it('allows extra seats on Team and reports overage billing', async () => {
      const team = makePlan({
        id: 'plan_team',
        tier: 'TEAM',
        seatAllowance: 3,
        perSeatOverageKes: 500,
      });
      const mocks = build({
        subscription: makeSubscription(team),
        plans: { TEAM: team } as Record<HisaflowPlanTier, HisaflowPlan>,
      });
      mocks.prisma.membershipCount.mockResolvedValueOnce(6);

      const result = await mocks.service.updateSeats('org_1', 2);

      expect(result.seatAllowance).toBe(5);
      expect(result.seatCount).toBe(6);
      expect(result.overageSeats).toBe(1);
      expect(result.overageRateKes).toBe(500);
      expect(result.autoBilled).toBe(true);
      expect(mocks.prisma.subscriptionUpdate).toHaveBeenCalledWith({
        where: { id: 'sub_1' },
        data: { seatAllowance: 5, seatCount: 6 },
      });
    });

    it('routes Solo to the Team paywall when extra seats are requested', async () => {
      const solo = makePlan();
      const mocks = build({
        subscription: makeSubscription(solo),
        plans: { SOLO: solo } as Record<HisaflowPlanTier, HisaflowPlan>,
      });

      await expect(mocks.service.updateSeats('org_1', 1)).rejects.toBeInstanceOf(
        FeatureLockedException,
      );
    });
  });

  describe('changePaymentMethod', () => {
    it('returns the Paystack card-update link for an existing card subscription', async () => {
      const solo = makePlan();
      const mocks = build({
        subscription: makeSubscription(solo),
        plans: { SOLO: solo } as Record<HisaflowPlanTier, HisaflowPlan>,
      });

      const result = await mocks.service.changePaymentMethod('org_1', 'CARD');

      expect(result.action).toBe('update_card_link');
      expect(result.url).toBe('https://paystack.com/manage/SUB_OLD');
      expect(
        mocks.paystack.generateUpdateSubscriptionLink,
      ).toHaveBeenCalledWith('SUB_OLD');
    });

    it('updates the M-Pesa number in place', async () => {
      const solo = makePlan();
      const mocks = build({
        subscription: makeSubscription(solo, {
          paymentMethod: SubscriptionPaymentMethod.MPESA,
          mpesaPhone: '+254700000000',
          paystackSubscriptionCode: null,
        }),
        plans: { SOLO: solo } as Record<HisaflowPlanTier, HisaflowPlan>,
      });

      const result = await mocks.service.changePaymentMethod(
        'org_1',
        'MPESA',
        '0712345678',
      );

      expect(result.action).toBe('updated');
      expect(mocks.prisma.subscriptionUpdate).toHaveBeenCalledWith({
        where: { id: 'sub_1' },
        data: { mpesaPhone: '+254712345678' },
      });
    });

    it('starts an M-Pesa checkout when switching away from card', async () => {
      const solo = makePlan();
      const mocks = build({
        subscription: makeSubscription(solo),
        plans: { SOLO: solo } as Record<HisaflowPlanTier, HisaflowPlan>,
      });

      const result = await mocks.service.changePaymentMethod(
        'org_1',
        'MPESA',
        '0712345678',
      );

      expect(result.action).toBe('checkout');
      expect(mocks.paystack.disableSubscription).toHaveBeenCalledWith('SUB_OLD');
      expect(mocks.mpesaCheckout.start).toHaveBeenCalled();
    });
  });

  describe('listInvoices', () => {
    it('pulls receipts from Paystack transactions when available', async () => {
      const solo = makePlan();
      const mocks = build({
        subscription: makeSubscription(solo),
        plans: { SOLO: solo } as Record<HisaflowPlanTier, HisaflowPlan>,
      });
      mocks.paystack.fetchCustomer.mockResolvedValueOnce({
        status: true,
        message: 'ok',
        data: { id: 42, customer_code: 'CUS_1', email: 'owner@example.com' },
      });
      mocks.paystack.listTransactions.mockResolvedValueOnce({
        status: true,
        message: 'ok',
        data: [
          {
            id: 99,
            reference: 'ref_x',
            status: 'success',
            amount: 250000,
            currency: 'KES',
            channel: 'mobile_money',
            created_at: '2026-09-01T00:00:00.000Z',
            paid_at: '2026-09-01T00:05:00.000Z',
            gateway_response: 'Successful',
          },
        ],
      });
      mocks.prisma.attemptFindMany.mockResolvedValueOnce([
        {
          id: 'att_1',
          paystackReference: 'ref_x',
          amountKes: 2500,
          method: 'MPESA',
          status: PaymentAttemptStatus.SUCCESS,
          attemptNumber: 1,
          plan: solo,
          attemptedAt: new Date('2026-09-01T00:00:00.000Z'),
          resolvedAt: new Date('2026-09-01T00:05:00.000Z'),
          errorMessage: null,
        },
      ]);

      const invoices = await mocks.service.listInvoices('org_1');

      // Resolves the stored CUS_ code to the numeric id Paystack's list
      // endpoint requires, then lists transactions for that customer.
      expect(mocks.paystack.fetchCustomer).toHaveBeenCalledWith('CUS_1');
      expect(mocks.paystack.listTransactions).toHaveBeenCalledWith({
        customerId: 42,
        perPage: 50,
      });
      expect(invoices[0]).toMatchObject({
        reference: 'ref_x',
        amountKes: 2500,
        method: 'MPESA',
        status: PaymentAttemptStatus.SUCCESS,
        planName: 'Solo',
        planTier: 'SOLO',
        source: 'paystack',
      });
    });

    it('falls back to the local audit trail when Paystack is unavailable', async () => {
      const solo = makePlan();
      const mocks = build({
        subscription: makeSubscription(solo),
        plans: { SOLO: solo } as Record<HisaflowPlanTier, HisaflowPlan>,
      });
      mocks.prisma.attemptFindMany.mockResolvedValueOnce([
        {
          id: 'att_1',
          paystackReference: 'ref_1',
          amountKes: 2500,
          method: 'CARD',
          status: PaymentAttemptStatus.SUCCESS,
          attemptNumber: 1,
          plan: solo,
          attemptedAt: new Date('2026-09-01T00:00:00.000Z'),
          resolvedAt: new Date('2026-09-01T00:05:00.000Z'),
          errorMessage: null,
        },
      ]);

      const invoices = await mocks.service.listInvoices('org_1');

      expect(invoices).toHaveLength(1);
      expect(invoices[0]).toMatchObject({
        reference: 'ref_1',
        amountKes: 2500,
        planName: 'Solo',
        planTier: 'SOLO',
        status: PaymentAttemptStatus.SUCCESS,
        source: 'local',
      });
    });
  });
});
