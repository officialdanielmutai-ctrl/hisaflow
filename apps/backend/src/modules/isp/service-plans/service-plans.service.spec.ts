import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { ServicePlansService } from './service-plans.service';

const ORG = 'org_a';
const OTHER_ORG = 'org_b';

function build(plan: any = { id: 'plan_1', organizationId: ORG, name: 'Basic', price: 2500, billingCycle: 'MONTHLY', isActive: true }) {
  const servicePlan = {
    create: jest.fn(async ({ data }: any) => ({ id: 'plan_1', ...data })),
    findMany: jest.fn(async () => []),
    findFirst: jest.fn(async (args: any) =>
      args?.where?.organizationId === ORG ? plan : null,
    ),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
  };
  const db: any = { servicePlan };
  return { service: new ServicePlansService({ db } as unknown as PrismaService), servicePlan };
}

describe('ISP ServicePlansService', () => {
  it('creates a plan scoped to the calling organisation', async () => {
    const { service, servicePlan } = build();

    await service.create(ORG, { name: 'Home 10Mbps', price: 3000, billingCycle: 'MONTHLY' } as any);

    expect(servicePlan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: ORG, name: 'Home 10Mbps', price: 3000 }),
    });
  });

  it('lists only the calling org plans, optionally filtered by active state', async () => {
    const { service, servicePlan } = build();

    await service.findAll(ORG, true);

    expect(servicePlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG, isActive: true } }),
    );
  });

  it('omits the active filter when activeOnly is undefined', async () => {
    const { service, servicePlan } = build();

    await service.findAll(ORG);

    expect(servicePlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG } }),
    );
  });

  it('throws NotFound when reading another org plan', async () => {
    const { service, servicePlan } = build();

    await expect(service.findOne(OTHER_ORG, 'plan_1')).rejects.toThrow(NotFoundException);
    expect(servicePlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'plan_1', organizationId: OTHER_ORG } }),
    );
  });

  it('cannot update another org plan (findOne gate runs first)', async () => {
    const { service, servicePlan } = build();

    await expect(service.update(OTHER_ORG, 'plan_1', { price: 1 } as any)).rejects.toThrow(
      NotFoundException,
    );
    expect(servicePlan.update).not.toHaveBeenCalled();
  });

  it('soft-deletes a plan by deactivating it', async () => {
    const { service, servicePlan } = build();

    await service.remove(ORG, 'plan_1');

    expect(servicePlan.update).toHaveBeenCalledWith({
      where: { id: 'plan_1' },
      data: { isActive: false },
    });
  });
});
