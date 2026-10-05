import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma.service';
import { NotificationsService } from './notifications.service';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

import * as webpush from 'web-push';

const setVapidDetails = webpush.setVapidDetails as unknown as jest.Mock;
const sendNotification = webpush.sendNotification as unknown as jest.Mock;

function build(opts: { configured?: boolean; members?: any[]; subs?: any[] } = {}) {
  const pushSubscription = {
    upsert: jest.fn(async ({ create }: any) => ({ id: 'sub_new', ...create })),
    findMany: jest.fn(async () => opts.subs ?? []),
    delete: jest.fn(async () => ({})),
  };
  const orgMembership = { findMany: jest.fn(async () => opts.members ?? []) };
  const db: any = { pushSubscription, orgMembership };
  const config = {
    get: jest.fn((key: string) => {
      if (!opts.configured) return undefined;
      if (key === 'NEXT_PUBLIC_VAPID_PUBLIC_KEY') return 'public';
      if (key === 'VAPID_PRIVATE_KEY') return 'private';
      return undefined;
    }),
  };
  const service = new NotificationsService(
    { db } as unknown as PrismaService,
    config as unknown as ConfigService,
  );
  return { service, pushSubscription, orgMembership };
}

beforeEach(() => {
  setVapidDetails.mockReset();
  sendNotification.mockReset();
});

describe('NotificationsService — subscribe', () => {
  it('rejects a payload without an endpoint', async () => {
    const { service } = build();

    await expect(service.subscribe('user_1', { keys: {} })).rejects.toThrow(
      'Invalid subscription payload',
    );
  });

  it('upserts a subscription keyed by endpoint', async () => {
    const { service, pushSubscription } = build();

    await service.subscribe('user_1', {
      endpoint: 'https://push/abc',
      keys: { p256dh: 'p', auth: 'a' },
    });

    expect(pushSubscription.upsert.mock.calls[0][0]).toMatchObject({
      where: { endpoint: 'https://push/abc' },
      create: { userId: 'user_1', endpoint: 'https://push/abc', p256dh: 'p', auth: 'a' },
    });
  });
});

describe('NotificationsService — push delivery', () => {
  it('does nothing when VAPID is not configured', async () => {
    const { service, orgMembership } = build({ configured: false });

    await service.sendPushToOrganization('org_a', { title: 'Hi', body: 'There' });

    expect(orgMembership.findMany).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('sends to every subscription of the org members', async () => {
    const { service } = build({
      configured: true,
      members: [{ userId: 'u1' }, { userId: 'u2' }],
      subs: [
        { id: 's1', endpoint: 'e1', p256dh: 'p1', auth: 'a1' },
        { id: 's2', endpoint: 'e2', p256dh: 'p2', auth: 'a2' },
      ],
    });

    await service.sendPushToOrganization('org_a', { title: 'Low stock', body: 'Sugar' });

    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(sendNotification.mock.calls[0][0]).toEqual({
      endpoint: 'e1',
      keys: { p256dh: 'p1', auth: 'a1' },
    });
  });

  it('deletes a subscription that the push service reports as gone (410)', async () => {
    const { service, pushSubscription } = build({
      configured: true,
      members: [{ userId: 'u1' }],
      subs: [{ id: 's1', endpoint: 'e1', p256dh: 'p', auth: 'a' }],
    });
    sendNotification.mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }));

    await service.sendPushToOrganization('org_a', { title: 'x', body: 'y' });

    expect(pushSubscription.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
  });

  it('does not delete a subscription on a transient send error', async () => {
    const { service, pushSubscription } = build({
      configured: true,
      members: [{ userId: 'u1' }],
      subs: [{ id: 's1', endpoint: 'e1', p256dh: 'p', auth: 'a' }],
    });
    sendNotification.mockRejectedValueOnce(Object.assign(new Error('500'), { statusCode: 500 }));

    await service.sendPushToOrganization('org_a', { title: 'x', body: 'y' });

    expect(pushSubscription.delete).not.toHaveBeenCalled();
  });
});
