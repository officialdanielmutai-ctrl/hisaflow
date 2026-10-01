import {
  PaymentAttemptStatus,
  SubscriptionPaymentMethod,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AfricasTalkingProvider } from '../../../infrastructure/providers/africas-talking.provider';
import { NotificationsService } from '../../notifications/notifications.service';
import { PaystackService } from '../paystack/paystack.service';
import { MpesaRenewalService } from './mpesa-renewal.service';

/**
 * The first M-Pesa charge is created by MpesaCheckoutService (no Subscription
 * yet). The charge.success webhook must create the Subscription that the
 * renewal loop then owns. This is the F-10 close-out path.
 */
function createPrismaMock() {
  const plan = {
    id: 'plan_solo',
    tier: 'SOLO',
    name: 'Solo',
    priceKes: 2500,
    seatAllowance: 1,
    paystackPlanCode: 'PLN_SOLO',
    isActive: true,
  };
  let attempt = {
    id: 'att_first',
    organizationId: 'org_1',
    subscriptionId: null as string | null,
    hisaflowPlanId: 'plan_solo',
    amountKes: 2500,
    method: SubscriptionPaymentMethod.MPESA,
    paystackReference: 'HF-MPESA-SOLO-1',
    status: PaymentAttemptStatus.PENDING,
    attemptNumber: 1,
    errorMessage: null as string | null,
    attemptedAt: new Date(),
    resolvedAt: null as Date | null,
  };
  let subscription: Record<string, unknown> | null = null;

  const mock = {
    db: {
      paymentAttempt: {
        findUnique: async ({
          where,
        }: {
          where: { paystackReference: string };
        }) =>
          attempt.paystackReference === where.paystackReference
            ? { ...attempt }
            : null,
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<typeof attempt>;
        }) => {
          if (attempt.id === where.id) attempt = { ...attempt, ...data };
          return { ...attempt };
        },
        findMany: async () => [],
      },
      hisaflowPlan: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          plan.id === where.id ? plan : null,
      },
      subscription: {
        findUnique: async ({
          where,
        }: {
          where: { organizationId: string };
        }) =>
          subscription &&
          (subscription.organizationId as string) === where.organizationId
            ? { ...subscription }
            : null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          subscription = { id: 'sub_new', ...data };
          return subscription;
        },
        update: async ({
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          subscription = { ...subscription, ...data };
          return subscription;
        },
        findFirst: async () => null,
      },
      alert: {
        create: async ({ data }: { data: Record<string, unknown> }) => data,
        updateMany: async () => ({ count: 0 }),
      },
      organization: {
        findUnique: async () => ({ name: 'Org', phone: null }),
      },
      orgMembership: {
        findFirst: async () => null,
      },
    },
  };

  return {
    mock: mock as unknown as PrismaService,
    getAttempt: () => attempt,
    getSubscription: () => subscription,
  };
}

describe('MpesaRenewalService first charge (F-10)', () => {
  function build() {
    const prisma = createPrismaMock();
    const service = new MpesaRenewalService(
      prisma.mock,
      { chargeMobileMoney: jest.fn() } as unknown as PaystackService,
      { sendPushToOrganization: jest.fn() } as unknown as NotificationsService,
      { sendSms: jest.fn() } as unknown as AfricasTalkingProvider,
    );
    return { prisma, service };
  }

  it('creates an M-Pesa subscription on the first charge.success and links the attempt', async () => {
    const { prisma, service } = build();

    await service.handleChargeSuccess({
      reference: 'HF-MPESA-SOLO-1',
      amount: 250000,
      channel: 'mobile_money',
      metadata: { mpesaPhone: '+254712345678' },
    });

    expect(prisma.getAttempt().status).toBe(PaymentAttemptStatus.SUCCESS);
    expect(prisma.getAttempt().subscriptionId).toBe('sub_new');

    const subscription = prisma.getSubscription();
    expect(subscription).not.toBeNull();
    expect(subscription?.status).toBe(SubscriptionStatus.ACTIVE);
    expect(subscription?.paymentMethod).toBe(SubscriptionPaymentMethod.MPESA);
    expect(subscription?.mpesaPhone).toBe('+254712345678');
    expect(subscription?.nextRenewalDate).toBeInstanceOf(Date);
  });

  it('falls back to the authorization phone when metadata has none', async () => {
    const { prisma, service } = build();

    await service.handleChargeSuccess({
      reference: 'HF-MPESA-SOLO-1',
      amount: 250000,
      channel: 'mobile_money',
      authorization: { mobile_money_number: '+254700000001' },
    });

    expect(prisma.getSubscription()?.mpesaPhone).toBe('+254700000001');
  });

  it('ignores an unknown reference without throwing', async () => {
    const { prisma, service } = build();

    await expect(
      service.handleChargeSuccess({ reference: 'unknown_ref', amount: 1000 }),
    ).resolves.toBeUndefined();
    expect(prisma.getSubscription()).toBeNull();
  });
});
