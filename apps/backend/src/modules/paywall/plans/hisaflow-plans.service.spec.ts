import { BadRequestException } from '@nestjs/common';
import { HisaflowPlanTier } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { PaystackService } from '../paystack/paystack.service';
import { HisaflowPlansService } from './hisaflow-plans.service';

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
  const store = new Map<HisaflowPlanTier, PlanRow>();
  let sequence = 0;

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
          const existing = store.get(where.tier);
          if (existing) return existing;
          const row: PlanRow = {
            id: `plan_${++sequence}`,
            paystackPlanCode: null,
            ...create,
          };
          store.set(where.tier, row);
          return row;
        },
        findMany: async ({
          where,
        }: {
          where?: { isActive?: boolean };
        } = {}): Promise<PlanRow[]> => {
          let rows = [...store.values()];
          if (where?.isActive !== undefined) {
            rows = rows.filter((row) => row.isActive === where.isActive);
          }
          return rows.sort((a, b) => a.priceKes - b.priceKes);
        },
        findUnique: async ({
          where,
        }: {
          where: { tier: HisaflowPlanTier };
        }): Promise<PlanRow | null> => store.get(where.tier) ?? null,
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<PlanRow>;
        }): Promise<PlanRow> => {
          const row = [...store.values()].find((r) => r.id === where.id);
          if (!row) throw new Error(`No plan ${where.id}`);
          Object.assign(row, data);
          return row;
        },
      },
    },
  };

  return { mock: mock as unknown as PrismaService, store };
}

function createPaystackMock(existingPlans: unknown[] = []) {
  return {
    listPlans: jest.fn(async () => ({
      status: true,
      message: 'ok',
      data: existingPlans,
    })),
    createPlan: jest.fn(
      async (input: { name: string; amount: number; interval: string }) => ({
        status: true,
        message: 'ok',
        data: {
          id: 1,
          name: input.name,
          plan_code: `PLN_${input.name.toUpperCase()}`,
          amount: input.amount,
          interval: input.interval,
          currency: 'KES',
        },
      }),
    ),
  } as unknown as PaystackService & {
    listPlans: jest.Mock;
    createPlan: jest.Mock;
  };
}

describe('HisaflowPlansService (Phase B)', () => {
  it('seeds the three tiers without fabricating an unpriced Growth price', async () => {
    const prisma = createPrismaMock();
    const service = new HisaflowPlansService(prisma.mock, createPaystackMock());

    await service.seedDefaults();

    const all = await service.listAll();
    expect(all).toHaveLength(3);

    const byTier = Object.fromEntries(all.map((plan) => [plan.tier, plan]));
    expect(byTier.SOLO.priceKes).toBe(2500);
    expect(byTier.SOLO.seatAllowance).toBe(1);
    expect(byTier.TEAM.priceKes).toBe(5500);
    expect(byTier.TEAM.seatAllowance).toBe(3);
    expect(byTier.GROWTH.isActive).toBe(false);
    expect(byTier.GROWTH.priceKes).toBe(0);

    // Only the priced/active tiers are exposed to the paywall.
    const active = await service.listActive();
    expect(active.map((plan) => plan.tier).sort()).toEqual(['SOLO', 'TEAM']);
  });

  it('creates a Paystack Plan per priced tier and skips the unpriced Growth tier', async () => {
    const prisma = createPrismaMock();
    const paystack = createPaystackMock();
    const service = new HisaflowPlansService(prisma.mock, paystack);

    const results = await service.syncPaystackPlans();

    const byTier = Object.fromEntries(results.map((r) => [r.tier, r]));
    expect(byTier.SOLO.planCode).toBe('PLN_SOLO');
    expect(byTier.TEAM.planCode).toBe('PLN_TEAM');
    expect(byTier.GROWTH.skipped).toBe(true);
    expect(paystack.createPlan).toHaveBeenCalledTimes(2);

    const solo = await service.findByTier(HisaflowPlanTier.SOLO);
    expect(solo?.paystackPlanCode).toBe('PLN_SOLO');
  });

  it('is idempotent: never re-creates a Paystack Plan that is already stored', async () => {
    const prisma = createPrismaMock();
    const paystack = createPaystackMock();
    const service = new HisaflowPlansService(prisma.mock, paystack);

    await service.syncPaystackPlans();
    paystack.createPlan.mockClear();

    const secondPass = await service.syncPaystackPlans();

    expect(paystack.createPlan).not.toHaveBeenCalled();
    expect(secondPass.find((r) => r.tier === 'SOLO')?.planCode).toBe('PLN_SOLO');
  });

  it('reuses an existing Paystack Plan with the same name+amount instead of duplicating', async () => {
    const prisma = createPrismaMock();
    const paystack = createPaystackMock([
      {
        id: 9,
        name: 'Solo',
        plan_code: 'PLN_PREEXISTING_SOLO',
        amount: 250000,
        interval: 'monthly',
        currency: 'KES',
      },
    ]);
    const service = new HisaflowPlansService(prisma.mock, paystack);

    const solo = await service.findByTier(HisaflowPlanTier.SOLO);
    const code = await service.ensurePaystackPlanCode(solo!);

    expect(code).toBe('PLN_PREEXISTING_SOLO');
    expect(paystack.createPlan).not.toHaveBeenCalled();
  });

  it('refuses to create a Paystack Plan for the unpriced/inactive Growth tier', async () => {
    const prisma = createPrismaMock();
    const service = new HisaflowPlansService(prisma.mock, createPaystackMock());

    const growth = await service.findByTier(HisaflowPlanTier.GROWTH);

    await expect(service.ensurePaystackPlanCode(growth!)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
