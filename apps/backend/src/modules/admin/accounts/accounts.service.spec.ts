import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AdminAuditService } from '../audit/admin-audit.service';
import { AccountsService } from './accounts.service';

jest.mock('@clerk/backend', () => ({
  createClerkClient: jest.fn(),
}));

import { createClerkClient } from '@clerk/backend';

const mockedCreateClerkClient = createClerkClient as unknown as jest.Mock;
const adminUser = { id: 'adm_1', name: 'Admin One' } as any;

function build(opts: { users?: any[]; organization?: any } = {}) {
  const organization: any = {
    findMany: jest.fn(async (): Promise<any[]> => opts.organization ? [opts.organization] : []),
    count: jest.fn(async (): Promise<number> => opts.organization ? 1 : 0),
    findUnique: jest.fn(async (): Promise<any> => opts.organization ?? null),
  };
  const adminAuditLog: any = {
    findMany: jest.fn(async (): Promise<any[]> => []),
    findFirst: jest.fn(async (): Promise<any> => null),
  };
  const db: any = { organization, adminAuditLog };

  const clerk = {
    users: {
      getUser: jest.fn(async (id: string) => ({
        banned: false,
        lastActiveAt: '2026-01-01T10:00:00.000Z',
        imageUrl: 'https://img.example/u.png',
        emailAddresses: [{ emailAddress: `${id}@verified.com` }],
      })),
      banUser: jest.fn(async () => ({})),
      unbanUser: jest.fn(async () => ({})),
    },
  };
  mockedCreateClerkClient.mockReturnValue(clerk);

  const configService = { get: jest.fn(() => 'sk_test_secret') };
  const auditService: any = { write: jest.fn(async () => ({})) };

  const service = new AccountsService(
    { db } as unknown as PrismaService,
    configService as unknown as ConfigService,
    auditService as unknown as AdminAuditService,
  );
  return { service, organization, adminAuditLog, clerk, auditService };
}

describe('AccountsService', () => {
  beforeEach(() => mockedCreateClerkClient.mockReset());

  describe('listAccounts', () => {
    it('enriches every org with its freeze status from the audit log', async () => {
      const { service, organization, adminAuditLog } = build({
        organization: { id: 'org_1', name: 'Acme', createdAt: new Date(), _count: {} },
      });
      adminAuditLog.findMany.mockResolvedValue([
        { targetId: 'org_1', actionType: 'account.freeze', createdAt: new Date() },
      ]);

      const result = await service.listAccounts({} as any);

      expect(result.items[0]).toMatchObject({ id: 'org_1', status: 'FROZEN' });
      expect(result.limit).toBe(20);
    });

    it('clamps the page size to 100 and builds an insensitive search', async () => {
      const { service, organization } = build();

      await service.listAccounts({ search: 'acme', limit: 500, offset: 5 } as any);

      const args = organization.findMany.mock.calls[0][0];
      expect(args.take).toBe(100);
      expect(args.skip).toBe(5);
      expect(args.where.OR[0]).toEqual({ name: { contains: 'acme', mode: 'insensitive' } });
      expect(args.where.OR[2].users.some.user.OR).toHaveLength(2);
    });

    it('applies the status filter after enrichment', async () => {
      const { service, adminAuditLog } = build({
        organization: { id: 'org_1', name: 'Acme', createdAt: new Date(), _count: {} },
      });
      adminAuditLog.findMany.mockResolvedValue([
        { targetId: 'org_1', actionType: 'account.freeze', createdAt: new Date() },
      ]);

      const result = await service.listAccounts({ status: 'active' } as any);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(1);
    });

    it('filters by business type unless "all"', async () => {
      const { service, organization } = build();

      await service.listAccounts({ businessType: 'RETAIL' } as any);
      expect(organization.findMany.mock.calls[0][0].where.businessType).toBe('RETAIL');

      organization.findMany.mockClear();
      await service.listAccounts({ businessType: 'all' } as any);
      expect(organization.findMany.mock.calls[0][0].where.businessType).toBeUndefined();
    });
  });

  describe('getAccount', () => {
    it('throws NotFound for an unknown org', async () => {
      const { service } = build();

      await expect(service.getAccount('nope')).rejects.toThrow(NotFoundException);
    });

    it('merges live Clerk status into each member', async () => {
      const { service, adminAuditLog } = build({
        organization: {
          id: 'org_1',
          name: 'Acme',
          businessType: 'RETAIL',
          currency: 'KES',
          country: 'KE',
          createdAt: new Date(),
          updatedAt: new Date(),
          users: [
            { id: 'm1', role: 'OWNER', user: { id: 'u1', clerkId: 'cler_1', name: 'U', email: 'u@db.com', phone: null } },
          ],
          _count: { products: 2 },
        },
      });
      adminAuditLog.findFirst.mockResolvedValue({ actionType: 'account.freeze' });

      const result = await service.getAccount('org_1');

      expect(result.organization.status).toBe('FROZEN');
      expect(result.users[0].user).toMatchObject({
        banned: false,
        email: 'cler_1@verified.com',
        imageUrl: 'https://img.example/u.png',
      });
    });

    it('falls back to the local email when the Clerk lookup fails', async () => {
      const { service, clerk } = build({
        organization: {
          id: 'org_1',
          name: 'Acme',
          businessType: 'RETAIL',
          currency: 'KES',
          country: 'KE',
          createdAt: new Date(),
          updatedAt: new Date(),
          users: [
            { id: 'm1', role: 'OWNER', user: { id: 'u1', clerkId: 'cler_1', name: 'U', email: 'u@db.com', phone: null } },
          ],
          _count: {},
        },
      });
      clerk.users.getUser.mockRejectedValueOnce(new Error('clerk down'));

      const result = await service.getAccount('org_1');

      expect(result.users[0].user).toMatchObject({ email: 'u@db.com', banned: false });
    });
  });

  describe('freezeAccount / unfreezeAccount', () => {
    const orgWithUsers = {
      id: 'org_1',
      name: 'Acme',
      users: [{ user: { clerkId: 'cler_1' } }, { user: { clerkId: null } }],
    };

    it('bans every linked Clerk user and audits the freeze', async () => {
      const { service, organization, clerk, auditService } = build({ organization: orgWithUsers });

      const result = await service.freezeAccount('org_1', 'fraud', adminUser, '1.2.3.4');

      expect(organization.findUnique).toHaveBeenCalled();
      expect(clerk.users.banUser).toHaveBeenCalledTimes(1);
      expect(clerk.users.banUser).toHaveBeenCalledWith('cler_1');
      expect(result.bannedCount).toBe(1);
      expect(auditService.write).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'account.freeze', targetId: 'org_1', reason: 'fraud' }),
      );
    });

    it('records per-user Clerk failures without aborting the freeze', async () => {
      const { service, clerk, auditService } = build({ organization: orgWithUsers });
      clerk.users.banUser.mockRejectedValueOnce(new Error('clerk 500'));

      const result = await service.freezeAccount('org_1', 'fraud', adminUser);

      expect(result.bannedCount).toBe(0);
      const metadata = auditService.write.mock.calls[0][0].metadata;
      expect(metadata.errors).toEqual(['cler_1: clerk 500']);
    });

    it('throws NotFound freezing an unknown org', async () => {
      const { service } = build();

      await expect(service.freezeAccount('nope', 'r', adminUser)).rejects.toThrow(NotFoundException);
    });

    it('unbans every linked Clerk user and audits the unfreeze', async () => {
      const { service, clerk, auditService } = build({ organization: orgWithUsers });

      const result = await service.unfreezeAccount('org_1', 'cleared', adminUser);

      expect(clerk.users.unbanUser).toHaveBeenCalledWith('cler_1');
      expect(result.unbannedCount).toBe(1);
      expect(auditService.write).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'account.unfreeze' }),
      );
    });
  });

  describe('getAccountHistory', () => {
    it('reads the org audit trail with the admin relation', async () => {
      const { service, adminAuditLog } = build();

      await service.getAccountHistory('org_1');

      expect(adminAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { targetType: 'organization', targetId: 'org_1' },
          include: expect.objectContaining({ admin: expect.anything() }),
        }),
      );
    });
  });
});
