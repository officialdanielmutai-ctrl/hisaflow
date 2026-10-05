import { NotFoundException } from '@nestjs/common';
import { SubscriberStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { RouterActionService } from '../routers/router-action.service';
import { SubscribersService } from './subscribers.service';

const ORG = 'org_a';
const OTHER_ORG = 'org_b';

function build(subscriber: any = { id: 'sub_1', organizationId: ORG, name: 'Jane', status: 'ACTIVE' }) {
  const subscriberDelegate = {
    create: jest.fn(async ({ data }: any) => ({ id: 'sub_1', ...data })),
    findMany: jest.fn(async () => []),
    findFirst: jest.fn(async (args: any) =>
      args?.where?.organizationId === ORG ? subscriber : null,
    ),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
  };
  const routerAction = {
    findMany: jest.fn(async () => []),
  };
  const db: any = { subscriber: subscriberDelegate, routerAction };
  const routerActionService = {
    suspend: jest.fn(async () => ({ success: true, actionId: 'ra_1' })),
    reconnect: jest.fn(async () => ({ success: true, actionId: 'ra_2' })),
  };
  const service = new SubscribersService(
    { db } as unknown as PrismaService,
    routerActionService as unknown as RouterActionService,
  );
  return { service, subscriberDelegate, routerAction, routerActionService };
}

describe('ISP SubscribersService', () => {
  it('creates a subscriber scoped to the calling organisation', async () => {
    const { service, subscriberDelegate } = build();

    await service.create(ORG, { name: 'Jane', planId: 'plan_1' } as any);

    expect(subscriberDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: ORG, name: 'Jane', planId: 'plan_1' }),
      }),
    );
  });

  it('strips an empty planId so Prisma does not receive undefined relations', async () => {
    const { service, subscriberDelegate } = build();

    await service.create(ORG, { name: 'Jane', planId: '' } as any);

    const data = subscriberDelegate.create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('planId');
  });

  it('lists subscribers scoped to the org with optional status and plan filters', async () => {
    const { service, subscriberDelegate } = build();

    await service.findAll(ORG, SubscriberStatus.ACTIVE, 'plan_1');

    expect(subscriberDelegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG, status: SubscriberStatus.ACTIVE, planId: 'plan_1' },
      }),
    );
  });

  it('throws NotFound when reading a subscriber from another org', async () => {
    const { service, subscriberDelegate } = build();

    await expect(service.findOne(OTHER_ORG, 'sub_1')).rejects.toThrow(NotFoundException);
    expect(subscriberDelegate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sub_1', organizationId: OTHER_ORG } }),
    );
  });

  it('cannot update a subscriber from another org', async () => {
    const { service, subscriberDelegate } = build();

    await expect(service.update(OTHER_ORG, 'sub_1', { name: 'Hacked' } as any)).rejects.toThrow(
      NotFoundException,
    );
    expect(subscriberDelegate.update).not.toHaveBeenCalled();
  });

  it('normalises a cleared planId to null on update', async () => {
    const { service, subscriberDelegate } = build();

    await service.update(ORG, 'sub_1', { planId: '' } as any);

    expect(subscriberDelegate.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ planId: null }) }),
    );
  });

  it('updates subscriber status after the org-scoped existence check', async () => {
    const { service, subscriberDelegate } = build();

    await service.updateStatus(ORG, 'sub_1', SubscriberStatus.SUSPENDED);

    expect(subscriberDelegate.update).toHaveBeenCalledWith({
      where: { id: 'sub_1' },
      data: { status: SubscriberStatus.SUSPENDED },
    });
  });

  it('links a router reference without crossing org boundaries', async () => {
    const { service, subscriberDelegate } = build();

    await service.linkRouter(ORG, 'sub_1', 'router_1', 'pppoe-jane');

    expect(subscriberDelegate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub_1' },
        data: { routerId: 'router_1', routerAccountRef: 'pppoe-jane' },
      }),
    );
  });

  it('delegates manual suspend to RouterActionService with trigger "manual"', async () => {
    const { service, routerActionService } = build();

    await service.routerSuspend(ORG, 'sub_1');

    expect(routerActionService.suspend).toHaveBeenCalledWith(ORG, 'sub_1', 'manual');
  });

  it('delegates manual reconnect to RouterActionService with trigger "manual"', async () => {
    const { service, routerActionService } = build();

    await service.routerReconnect(ORG, 'sub_1');

    expect(routerActionService.reconnect).toHaveBeenCalledWith(ORG, 'sub_1', 'manual');
  });

  it('reads router actions scoped to both org and subscriber', async () => {
    const { service, routerAction } = build();

    await service.getRouterActions(ORG, 'sub_1');

    expect(routerAction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG, subscriberId: 'sub_1' },
        take: 10,
      }),
    );
  });
});
