import { ConnectionType, RouterActionStatus, RouterActionType, SubscriberStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { RoutersService } from './routers.service';
import { RouterActionService } from './router-action.service';

jest.mock('routeros-client', () => ({
  RouterOSClient: jest.fn(),
}));

import { RouterOSClient } from 'routeros-client';

const MockedRouterOSClient = RouterOSClient as unknown as jest.Mock;
const ORG = 'org_a';

function routerMenuChain() {
  const chain: any = {
    where: jest.fn(() => chain),
    get: jest.fn(async () => [{ '.id': '*1' }]),
    id: jest.fn(() => chain),
    set: jest.fn(async () => undefined),
  };
  return chain;
}

function build(subscriber: any = null) {
  const subscriberDelegate = {
    findFirst: jest.fn(async () => subscriber),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
  };
  const routerAction = {
    create: jest.fn(async ({ data }: any) => ({ id: 'ra_1', ...data })),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
  };
  const db: any = {
    subscriber: subscriberDelegate,
    routerAction,
    $transaction: jest.fn(async (ops: any) => Promise.all(ops)),
  };
  const routersService = {
    findWithCredentials: jest.fn(async () => ({
      id: 'r1',
      host: '10.0.0.1',
      port: 8729,
      apiUsername: 'admin',
      apiPassword: 'secret',
    })),
  };
  const service = new RouterActionService(
    { db } as unknown as PrismaService,
    routersService as unknown as RoutersService,
  );
  return { service, subscriberDelegate, routerAction, routersService, db };
}

const linkedSubscriber = {
  id: 'sub_1',
  organizationId: ORG,
  routerId: 'r1',
  routerAccountRef: 'ppp-jane',
  connectionType: ConnectionType.PPPOE,
};

describe('ISP RouterActionService', () => {
  beforeEach(() => {
    MockedRouterOSClient.mockReset();
  });

  it('returns a failure and does not touch the router when the subscriber is unknown', async () => {
    const { service, routerAction } = build(null);

    const result = await service.suspend('org_x', 'sub_missing', 'manual');

    expect(result).toEqual({ success: false, actionId: '', error: 'Subscriber not found' });
    expect(routerAction.create).not.toHaveBeenCalled();
  });

  it('returns a failure when the subscriber has no router linked', async () => {
    const { service, routerAction } = build({
      id: 'sub_1',
      organizationId: ORG,
      routerId: null,
      routerAccountRef: null,
    });

    const result = await service.reconnect(ORG, 'sub_1', 'manual');

    expect(result.success).toBe(false);
    expect(result.error).toBe('No router linked to this subscriber');
    expect(routerAction.create).not.toHaveBeenCalled();
  });

  it('suspends on the router, audits the action, and marks the subscriber SUSPENDED', async () => {
    const chain = routerMenuChain();
    MockedRouterOSClient.mockImplementation(() => ({
      connect: jest.fn(async () => ({ menu: jest.fn(() => chain) })),
      disconnect: jest.fn(),
    }));
    const { service, routerAction, subscriberDelegate, routersService } = build(linkedSubscriber);

    const result = await service.suspend(ORG, 'sub_1', 'billing');

    expect(result.success).toBe(true);
    expect(result.actionId).toBe('ra_1');
    expect(routersService.findWithCredentials).toHaveBeenCalledWith(ORG, 'r1');
    expect(routerAction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG,
          subscriberId: 'sub_1',
          routerId: 'r1',
          type: RouterActionType.SUSPEND,
          triggeredBy: 'billing',
          status: RouterActionStatus.PENDING,
        }),
      }),
    );
    expect(chain.set).toHaveBeenCalledWith({ disabled: 'true' });
    expect(routerAction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: RouterActionStatus.SUCCESS }) }),
    );
    expect(subscriberDelegate.update).toHaveBeenCalledWith({
      where: { id: 'sub_1' },
      data: { status: SubscriberStatus.SUSPENDED },
    });
  });

  it('reconnects on the router and marks the subscriber ACTIVE', async () => {
    const chain = routerMenuChain();
    MockedRouterOSClient.mockImplementation(() => ({
      connect: jest.fn(async () => ({ menu: jest.fn(() => chain) })),
      disconnect: jest.fn(),
    }));
    const { service, subscriberDelegate } = build(linkedSubscriber);

    const result = await service.reconnect(ORG, 'sub_1', 'manual');

    expect(result.success).toBe(true);
    expect(chain.set).toHaveBeenCalledWith({ disabled: 'false' });
    expect(subscriberDelegate.update).toHaveBeenCalledWith({
      where: { id: 'sub_1' },
      data: { status: SubscriberStatus.ACTIVE },
    });
  });

  it('marks the action FAILED after all router retries are exhausted', async () => {
    jest.useFakeTimers();
    try {
      MockedRouterOSClient.mockImplementation(() => ({
        connect: jest.fn(async () => {
          throw new Error('unreachable');
        }),
        disconnect: jest.fn(),
      }));
      const { service, routerAction } = build(linkedSubscriber);

      const pending = service.suspend(ORG, 'sub_1', 'reconciliation');
      await jest.runAllTimersAsync();
      const result = await pending;

      expect(result.success).toBe(false);
      expect(result.error).toBe('unreachable');
      expect(routerAction.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: RouterActionStatus.FAILED,
            lastError: 'unreachable',
          }),
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });
});
