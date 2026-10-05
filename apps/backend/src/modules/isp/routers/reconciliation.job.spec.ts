import { PrismaService } from '../../../infrastructure/prisma.service';
import { RoutersService, encryptPassword } from './routers.service';
import { ReconciliationJob } from './reconciliation.job';

jest.mock('routeros-client', () => ({ RouterOSClient: jest.fn() }));

import { RouterOSClient } from 'routeros-client';

const MockedRouterOSClient = RouterOSClient as unknown as jest.Mock;

const ORG = 'org_1';

function build(subscribers: any[] = []) {
  const router: any = {
    id: 'r1',
    organizationId: ORG,
    label: 'Office',
    host: '10.0.0.1',
    port: 8729,
    apiUsername: 'admin',
    apiPasswordEnc: encryptPassword('secret'),
    subscribers,
  };
  const alert: any = {
    findFirst: jest.fn(async (): Promise<any> => null),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
    create: jest.fn(async ({ data }: any) => ({ id: 'alert_1', ...data })),
  };
  const db: any = { router: { findMany: jest.fn(async () => [router]) }, alert };
  const service = new ReconciliationJob(
    { db } as unknown as PrismaService,
    {} as unknown as RoutersService,
  );
  return { service, db, alert, router };
}

function mockLiveAccounts(secrets: any[], hotspots: any[] = []) {
  const menu = (path: string) => ({
    get: jest.fn(async () => (path === '/ppp/secret' ? secrets : hotspots)),
  });
  MockedRouterOSClient.mockImplementation(() => ({
    connect: jest.fn(async () => ({ menu })),
    disconnect: jest.fn(),
  }));
}

describe('ReconciliationJob', () => {
  beforeAll(() => {
    process.env.ROUTER_ENCRYPTION_KEY = 'unit-test-router-key';
  });

  afterAll(() => {
    delete process.env.ROUTER_ENCRYPTION_KEY;
  });

  beforeEach(() => MockedRouterOSClient.mockReset());

  it('skips routers with no linked subscribers', async () => {
    const { service, alert } = build([]);
    mockLiveAccounts([]);

    await service.handleReconciliation();

    expect(alert.create).not.toHaveBeenCalled();
    expect(MockedRouterOSClient).not.toHaveBeenCalled();
  });

  it('continues past a router that cannot be reached', async () => {
    const { service, alert } = build([
      { id: 'sub_1', name: 'Jane', status: 'ACTIVE', routerAccountRef: 'ppp-jane' },
    ]);
    MockedRouterOSClient.mockImplementation(() => ({
      connect: jest.fn(async () => {
        throw new Error('unreachable');
      }),
      disconnect: jest.fn(),
    }));

    await service.handleReconciliation();

    expect(alert.create).not.toHaveBeenCalled();
  });

  it('flags a ROUTER_DRIFT alert when HisaFlow and the router disagree', async () => {
    const { service, alert } = build([
      { id: 'sub_1', name: 'Jane', status: 'ACTIVE', routerAccountRef: 'ppp-jane' },
    ]);
    mockLiveAccounts([{ name: 'ppp-jane', disabled: 'true' }]);

    await service.handleReconciliation();

    expect(alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG,
          type: 'ROUTER_DRIFT',
          severity: 'WARNING',
          title: expect.stringContaining('sub_1'),
          description: expect.stringContaining('mismatch'),
        }),
      }),
    );
  });

  it('does not flag when both agree the subscriber is suspended', async () => {
    const { service, alert } = build([
      { id: 'sub_1', name: 'Jane', status: 'SUSPENDED', routerAccountRef: 'ppp-jane' },
    ]);
    mockLiveAccounts([{ name: 'ppp-jane', disabled: 'true' }]);

    await service.handleReconciliation();

    expect(alert.create).not.toHaveBeenCalled();
  });

  it('flags an account missing on the router', async () => {
    const { service, alert } = build([
      { id: 'sub_1', name: 'Jane', status: 'ACTIVE', routerAccountRef: 'ppp-missing' },
    ]);
    mockLiveAccounts([{ name: 'ppp-jane', disabled: 'false' }]);

    await service.handleReconciliation();

    expect(alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ description: expect.stringContaining('not found') }),
      }),
    );
  });

  it('updates an existing drift alert instead of creating a duplicate', async () => {
    const { service, alert } = build([
      { id: 'sub_1', name: 'Jane', status: 'ACTIVE', routerAccountRef: 'ppp-jane' },
    ]);
    mockLiveAccounts([{ name: 'ppp-jane', disabled: 'true' }]);
    alert.findFirst.mockResolvedValueOnce({ id: 'existing_alert' });

    await service.handleReconciliation();

    expect(alert.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'existing_alert' } }),
    );
    expect(alert.create).not.toHaveBeenCalled();
  });
});
