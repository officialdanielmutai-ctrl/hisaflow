import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WorkOrderStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { WorkOrdersService } from './work-orders.service';

const ORG = 'org_a';
const OTHER_ORG = 'org_b';

function build(opts: { subscriberFound?: boolean; orderStatus?: WorkOrderStatus } = {}) {
  const subscriber = {
    findFirst: jest.fn(async (args: any) =>
      (opts.subscriberFound ?? true) && args?.where?.organizationId === ORG
        ? { id: 'sub_1', organizationId: ORG, name: 'Jane' }
        : null,
    ),
  };
  const workOrder = {
    create: jest.fn(async ({ data }: any) => ({ id: 'wo_1', ...data })),
    findMany: jest.fn(async () => []),
    findFirst: jest.fn(async (args: any) =>
      args?.where?.organizationId === ORG
        ? { id: 'wo_1', organizationId: ORG, status: opts.orderStatus ?? WorkOrderStatus.SCHEDULED }
        : null,
    ),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
  };
  const db: any = { subscriber, workOrder };
  return { service: new WorkOrdersService({ db } as unknown as PrismaService), subscriber, workOrder };
}

describe('ISP WorkOrdersService', () => {
  it('creates a work order scoped to the org and parses scheduledAt', async () => {
    const { service, subscriber, workOrder } = build();

    await service.create(ORG, {
      subscriberId: 'sub_1',
      title: 'Installation',
      scheduledAt: '2026-11-01T09:00:00.000Z',
    } as any);

    expect(subscriber.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sub_1', organizationId: ORG } }),
    );
    const data = workOrder.create.mock.calls[0][0].data;
    expect(data.organizationId).toBe(ORG);
    expect(data.scheduledAt).toEqual(new Date('2026-11-01T09:00:00.000Z'));
  });

  it('rejects creation for a subscriber outside the org', async () => {
    const { service, workOrder } = build({ subscriberFound: false });

    await expect(service.create(ORG, { subscriberId: 'foreign' } as any)).rejects.toThrow(
      NotFoundException,
    );
    expect(workOrder.create).not.toHaveBeenCalled();
  });

  it('lists work orders scoped to the org with optional filters', async () => {
    const { service, workOrder } = build();

    await service.findAll(ORG, WorkOrderStatus.IN_PROGRESS, 'sub_1');

    expect(workOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG, status: WorkOrderStatus.IN_PROGRESS, subscriberId: 'sub_1' },
      }),
    );
  });

  it('throws NotFound reading a work order from another org', async () => {
    const { service } = build();

    await expect(service.findOne(OTHER_ORG, 'wo_1')).rejects.toThrow(NotFoundException);
  });

  it('transitions SCHEDULED -> IN_PROGRESS', async () => {
    const { service, workOrder } = build({ orderStatus: WorkOrderStatus.SCHEDULED });

    await service.transition(ORG, 'wo_1', WorkOrderStatus.IN_PROGRESS);

    expect(workOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: WorkOrderStatus.IN_PROGRESS }),
      }),
    );
  });

  it('stamps completedAt when transitioning to COMPLETED', async () => {
    const { service, workOrder } = build({ orderStatus: WorkOrderStatus.IN_PROGRESS });

    await service.transition(ORG, 'wo_1', WorkOrderStatus.COMPLETED);

    const data = workOrder.update.mock.calls[0][0].data;
    expect(data.status).toBe(WorkOrderStatus.COMPLETED);
    expect(data.completedAt).toBeInstanceOf(Date);
  });

  it('rejects an invalid transition (SCHEDULED -> COMPLETED)', async () => {
    const { service, workOrder } = build({ orderStatus: WorkOrderStatus.SCHEDULED });

    await expect(service.transition(ORG, 'wo_1', WorkOrderStatus.COMPLETED)).rejects.toThrow(
      BadRequestException,
    );
    expect(workOrder.update).not.toHaveBeenCalled();
  });
});
