import { BadRequestException } from '@nestjs/common';
import { HisaflowPlanTier, PaymentAttemptStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { PaystackService } from '../paystack/paystack.service';
import { HisaflowPlansService } from '../plans/hisaflow-plans.service';
import {
  MpesaCheckoutService,
  normalizeKenyanPhone,
} from './mpesa-checkout.service';

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
  const orgMembershipFindFirst = jest.fn(async () => ({
    organizationId: 'org_1',
    role: 'OWNER',
    user: { id: 'user_1', email: 'owner@example.com' },
  }));

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
    createPlan: jest.fn(),
    initializeTransaction: jest.fn(
      async (input: { reference: string }) => ({
        status: true,
        message: 'ok',
        data: {
          authorization_url: 'https://checkout.paystack.com/mpesa123',
          access_code: 'mpesa123',
          reference: input.reference,
        },
      }),
    ),
  } as unknown as PaystackService & {
    initializeTransaction: jest.Mock;
  };
}

describe('MpesaCheckoutService (Phase C first charge)', () => {
  function build() {
    const prisma = createPrismaMock();
    const paystack = createPaystackMock();
    const plans = new HisaflowPlansService(prisma.mock, paystack);
    const service = new MpesaCheckoutService(prisma.mock, paystack, plans);
    return { prisma, paystack, service };
  }

  it('initializes a mobile_money checkout with no plan and stores the phone in metadata', async () => {
    const { prisma, paystack, service } = build();

    const result = await service.start({
      organizationId: 'org_1',
      tier: HisaflowPlanTier.SOLO,
      mpesaPhone: '0712345678',
    });

    expect(result.authorizationUrl).toBe(
      'https://checkout.paystack.com/mpesa123',
    );

    expect(prisma.paymentAttemptCreate).toHaveBeenCalledTimes(1);
    const attemptData = prisma.paymentAttemptCreate.mock.calls[0][0].data as {
      method: string;
      status: string;
      paystackReference: string;
    };
    expect(attemptData.method).toBe('MPESA');
    expect(attemptData.status).toBe(PaymentAttemptStatus.PENDING);
    expect(attemptData.paystackReference).toMatch(/^HF-MPESA-SOLO-/);

    const initInput = paystack.initializeTransaction.mock.calls[0][0] as {
      channels: string[];
      plan?: string;
      metadata: Record<string, unknown>;
    };
    expect(initInput.channels).toEqual(['mobile_money']);
    expect(initInput.plan).toBeUndefined();
    expect(initInput.metadata.mpesaPhone).toBe('+254712345678');
    expect(initInput.metadata.flow).toBe('mpesa_first_charge');
  });

  it('uses a caller-supplied email without looking up the org owner', async () => {
    const { prisma, paystack, service } = build();

    await service.start({
      organizationId: 'org_1',
      tier: HisaflowPlanTier.SOLO,
      mpesaPhone: '+254712345678',
      email: 'billing@example.com',
    });

    expect(prisma.orgMembershipFindFirst).not.toHaveBeenCalled();
    expect(paystack.initializeTransaction.mock.calls[0][0].email).toBe(
      'billing@example.com',
    );
  });

  it('rejects the unpriced Growth tier', async () => {
    const { service } = build();

    await expect(
      service.start({
        organizationId: 'org_1',
        tier: HisaflowPlanTier.GROWTH,
        mpesaPhone: '0712345678',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes Kenyan phone formats', () => {
    expect(normalizeKenyanPhone('0712345678')).toBe('+254712345678');
    expect(normalizeKenyanPhone('254712345678')).toBe('+254712345678');
    expect(normalizeKenyanPhone('+254712345678')).toBe('+254712345678');
    expect(normalizeKenyanPhone('712345678')).toBe('+254712345678');
  });
});
