import { BadRequestException } from '@nestjs/common';
import { HisaflowPlanTier, PaymentAttemptStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { PaystackService } from '../paystack/paystack.service';
import { HisaflowPlansService } from '../plans/hisaflow-plans.service';
import { CardCheckoutService } from './card-checkout.service';

interface PlanRow {
  id: string;
  tier: HisaflowPlanTier;
  name: string;
  description: string;
  priceKes: number;
  seatAllowance: number;
  isActive: boolean;
  paystackPlanCode: string | null;
}

function createPrismaMock() {
  const plans = new Map<HisaflowPlanTier, PlanRow>();
  let planSeq = 0;

  const paymentAttemptCreate = jest.fn(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'att_1',
      ...data,
    }),
  );
  const orgMembershipFindFirst = jest.fn(
    async ({ where }: { where: { organizationId?: string } }) => ({
      organizationId: where.organizationId ?? 'org_1',
      role: 'OWNER',
      user: { id: 'user_1', email: 'owner@example.com' },
    }),
  );

  const mock = {
    db: {
      hisaflowPlan: {
        upsert: async ({
          where,
          create,
        }: {
          where: { tier: HisaflowPlanTier };
          create: Omit<PlanRow, 'id' | 'paystackPlanCode'>;
        }): Promise<PlanRow> => {
          const existing = plans.get(where.tier);
          if (existing) return existing;
          const row: PlanRow = {
            id: `plan_${++planSeq}`,
            paystackPlanCode: null,
            ...create,
          };
          plans.set(where.tier, row);
          return row;
        },
        findUnique: async ({
          where,
        }: {
          where: { tier: HisaflowPlanTier };
        }): Promise<PlanRow | null> => plans.get(where.tier) ?? null,
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<PlanRow>;
        }): Promise<PlanRow> => {
          const row = [...plans.values()].find((p) => p.id === where.id)!;
          Object.assign(row, data);
          return row;
        },
        findMany: async (): Promise<PlanRow[]> => [...plans.values()],
      },
      paymentAttempt: { create: paymentAttemptCreate },
      orgMembership: { findFirst: orgMembershipFindFirst },
    },
  };

  return {
    mock: mock as unknown as PrismaService,
    paymentAttemptCreate,
    orgMembershipFindFirst,
  };
}

function createPaystackMock() {
  return {
    listPlans: jest.fn(async () => ({ status: true, message: 'ok', data: [] })),
    createPlan: jest.fn(async () => ({
      status: true,
      message: 'ok',
      data: {
        id: 1,
        name: 'Solo',
        plan_code: 'PLN_SOLO',
        amount: 250000,
        interval: 'monthly',
        currency: 'KES',
      },
    })),
    initializeTransaction: jest.fn(
      async (input: { reference: string }) => ({
        status: true,
        message: 'ok',
        data: {
          authorization_url: 'https://checkout.paystack.com/abc123',
          access_code: 'abc123',
          reference: input.reference,
        },
      }),
    ),
  } as unknown as PaystackService & {
    initializeTransaction: jest.Mock;
    createPlan: jest.Mock;
  };
}

describe('CardCheckoutService (Phase B)', () => {
  function build() {
    const prisma = createPrismaMock();
    const paystack = createPaystackMock();
    const plans = new HisaflowPlansService(prisma.mock, paystack);
    const service = new CardCheckoutService(prisma.mock, paystack, plans);
    return { prisma, paystack, service };
  }

  it('starts a card-only checkout, records a PENDING attempt, and attaches the plan code', async () => {
    const { prisma, paystack, service } = build();

    const result = await service.start({
      organizationId: 'org_1',
      tier: HisaflowPlanTier.SOLO,
    });

    expect(result.authorizationUrl).toBe('https://checkout.paystack.com/abc123');
    expect(result.amountKes).toBe(2500);

    // Attempt is written before Paystack is called, so the webhook can link back.
    expect(prisma.paymentAttemptCreate).toHaveBeenCalledTimes(1);
    const attemptData = prisma.paymentAttemptCreate.mock.calls[0][0].data as {
      organizationId: string;
      hisaflowPlanId: string;
      method: string;
      paystackReference: string;
      status: string;
    };
    expect(attemptData.organizationId).toBe('org_1');
    expect(attemptData.method).toBe('CARD');
    expect(attemptData.status).toBe(PaymentAttemptStatus.PENDING);
    expect(attemptData.paystackReference).toMatch(/^HF-SOLO-/);

    expect(paystack.initializeTransaction).toHaveBeenCalledTimes(1);
    const initInput = paystack.initializeTransaction.mock.calls[0][0] as {
      email: string;
      amount: number;
      plan: string;
      channels: string[];
      metadata: Record<string, unknown>;
    };
    expect(initInput.plan).toBe('PLN_SOLO');
    expect(initInput.amount).toBe(250000);
    expect(initInput.channels).toEqual(['card']);
    expect(initInput.email).toBe('owner@example.com');
    expect(initInput.metadata.organizationId).toBe('org_1');
  });

  it('uses a caller-supplied email without looking up the org owner', async () => {
    const { prisma, paystack, service } = build();

    await service.start({
      organizationId: 'org_1',
      tier: HisaflowPlanTier.SOLO,
      email: 'billing@example.com',
    });

    expect(prisma.orgMembershipFindFirst).not.toHaveBeenCalled();
    expect(paystack.initializeTransaction.mock.calls[0][0].email).toBe(
      'billing@example.com',
    );
  });

  it('rejects checkout for the unpriced/inactive Growth tier', async () => {
    const { service } = build();

    await expect(
      service.start({ organizationId: 'org_1', tier: HisaflowPlanTier.GROWTH }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
