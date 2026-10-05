import { NotFoundException } from '@nestjs/common';
import { RouterStatus } from '@prisma/client';
import { EntitlementsService } from '../../../core/entitlements/entitlements.service';
import { PrismaService } from '../../../infrastructure/prisma.service';
import {
  RoutersService,
  decryptPassword,
  encryptPassword,
} from './routers.service';

jest.mock('routeros-client', () => ({
  RouterOSClient: jest.fn(),
}));

import { RouterOSClient } from 'routeros-client';

const MockedRouterOSClient = RouterOSClient as unknown as jest.Mock;
const ORG = 'org_a';
const OTHER_ORG = 'org_b';

function build(opts: { routers?: any[]; existingCount?: number } = {}) {
  const routers = opts.routers ?? [];
  const router = {
    count: jest.fn(async () => opts.existingCount ?? 0),
    create: jest.fn(async ({ data }: any) => ({ id: 'r1', ...data })),
    findMany: jest.fn(async (args: any) =>
      routers.filter((r) => r.organizationId === args?.where?.organizationId),
    ),
    findFirst: jest.fn(async (args: any) =>
      routers.find((r) => r.id === args?.where?.id && r.organizationId === args?.where?.organizationId) ??
      null,
    ),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
    delete: jest.fn(async ({ where }: any) => ({ id: where.id })),
  };
  const entitlements = { assertMultiLocationAllowed: jest.fn(async () => undefined) };
  const db: any = { router };
  const service = new RoutersService(
    { db } as unknown as PrismaService,
    entitlements as unknown as EntitlementsService,
  );
  return { service, router, entitlements };
}

describe('ISP RoutersService', () => {
  beforeEach(() => {
    process.env.ROUTER_ENCRYPTION_KEY = 'unit-test-router-key';
    MockedRouterOSClient.mockReset();
  });

  afterAll(() => {
    delete process.env.ROUTER_ENCRYPTION_KEY;
  });

  describe('credential encryption', () => {
    it('round-trips a password through encrypt/decrypt', () => {
      const stored = encryptPassword('sup3r-secret');
      expect(stored).not.toContain('sup3r-secret');
      expect(decryptPassword(stored)).toBe('sup3r-secret');
    });

    it('throws on a malformed encrypted value', () => {
      expect(() => decryptPassword('not-a-valid-pair')).toThrow(/Malformed/);
    });
  });

  describe('CRUD', () => {
    it('enforces the multi-location entitlement and never stores the plaintext password', async () => {
      const { service, router, entitlements } = build({ existingCount: 1 });

      await service.create(ORG, {
        label: 'Office',
        host: '10.0.0.1',
        apiUsername: 'admin',
        apiPassword: 'plaintext',
      } as any);

      expect(entitlements.assertMultiLocationAllowed).toHaveBeenCalledWith(ORG, 1, 'isp-routers');
      const data = router.create.mock.calls[0][0].data;
      expect(data.apiPasswordEnc).toBeDefined();
      expect(data.apiPasswordEnc).not.toContain('plaintext');
      expect(data).not.toHaveProperty('apiPassword');
      expect(router.create.mock.calls[0][0].select).toBeDefined();
    });

    it('does not create a router when the entitlement gate rejects it', async () => {
      const { service, router, entitlements } = build({ existingCount: 2 });
      entitlements.assertMultiLocationAllowed.mockRejectedValue(new Error('Growth plan required'));

      await expect(
        service.create(ORG, { label: 'x', host: 'h', apiUsername: 'u', apiPassword: 'p' } as any),
      ).rejects.toThrow('Growth plan required');
      expect(router.create).not.toHaveBeenCalled();
    });

    it('lists routers scoped to the org', async () => {
      const { service, router } = build();

      await service.findAll(ORG);

      expect(router.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: ORG } }),
      );
    });

    it('throws NotFound reading another org router', async () => {
      const { service } = build();

      await expect(service.findOne(OTHER_ORG, 'r1')).rejects.toThrow(NotFoundException);
    });

    it('re-encrypts a changed password on update', async () => {
      const { service, router } = build({
        routers: [
          {
            id: 'r1',
            organizationId: ORG,
            host: '10.0.0.1',
            port: 8729,
            apiUsername: 'admin',
            apiPasswordEnc: encryptPassword('old'),
          },
        ],
      });

      await service.update(ORG, 'r1', { apiPassword: 'new-secret' } as any);

      const data = router.update.mock.calls[0][0].data;
      expect(data.apiPassword).toBeUndefined();
      expect(decryptPassword(data.apiPasswordEnc)).toBe('new-secret');
    });

    it('cannot delete another org router', async () => {
      const { service, router } = build();

      await expect(service.remove(OTHER_ORG, 'r1')).rejects.toThrow(NotFoundException);
      expect(router.delete).not.toHaveBeenCalled();
    });
  });

  describe('testConnection', () => {
    const storedRouter = () => ({
      id: 'r1',
      organizationId: ORG,
      host: '10.0.0.1',
      port: 8729,
      apiUsername: 'admin',
      apiPasswordEnc: encryptPassword('secret'),
    });

    it('records CONNECTED and returns the router identity on success', async () => {
      const { service, router } = build({ routers: [storedRouter()] });
      MockedRouterOSClient.mockImplementation(() => ({
        connect: jest.fn(async () => ({
          menu: () => ({ get: async () => [{ name: 'MikroTik-Office' }] }),
        })),
        disconnect: jest.fn(),
      }));

      const result = await service.testConnection(ORG, 'r1');

      expect(result.success).toBe(true);
      expect(result.routerIdentity).toBe('MikroTik-Office');
      expect(router.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'r1' },
          data: expect.objectContaining({ connectionStatus: RouterStatus.CONNECTED, lastError: null }),
        }),
      );
    });

    it('records ERROR and surfaces the failure message when the router is unreachable', async () => {
      const { service, router } = build({ routers: [storedRouter()] });
      MockedRouterOSClient.mockImplementation(() => ({
        connect: jest.fn(async () => {
          throw new Error('connection refused');
        }),
        disconnect: jest.fn(),
      }));

      const result = await service.testConnection(ORG, 'r1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('connection refused');
      expect(router.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'r1' },
          data: expect.objectContaining({
            connectionStatus: RouterStatus.ERROR,
            lastError: 'connection refused',
          }),
        }),
      );
    });

    it('throws NotFound when testing another org router', async () => {
      const { service } = build({ routers: [storedRouter()] });

      await expect(service.testConnection(OTHER_ORG, 'r1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findWithCredentials', () => {
    it('returns the decrypted API password to trusted internal callers only', async () => {
      const { service } = build({
        routers: [
          {
            id: 'r1',
            organizationId: ORG,
            host: '10.0.0.1',
            apiPasswordEnc: encryptPassword('secret'),
          },
        ],
      });

      const result = await service.findWithCredentials(ORG, 'r1');

      expect(result.apiPassword).toBe('secret');
    });

    it('throws NotFound for another org', async () => {
      const { service } = build({
        routers: [{ id: 'r1', organizationId: ORG, host: 'h', apiPasswordEnc: encryptPassword('s') }],
      });

      await expect(service.findWithCredentials(OTHER_ORG, 'r1')).rejects.toThrow(NotFoundException);
    });
  });
});
