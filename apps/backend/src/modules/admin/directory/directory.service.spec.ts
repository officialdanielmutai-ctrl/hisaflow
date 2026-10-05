import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AdminAuditService } from '../audit/admin-audit.service';
import { DirectoryService } from './directory.service';

jest.mock('@clerk/backend', () => ({
  createClerkClient: jest.fn(),
}));

import { createClerkClient } from '@clerk/backend';

const mockedCreateClerkClient = createClerkClient as unknown as jest.Mock;
const adminUser = { id: 'adm_1', name: 'Admin One' } as any;

function build() {
  const communicationConsent: any = {
    findMany: jest.fn(async (): Promise<any[]> => []),
    findUnique: jest.fn(async (): Promise<any> => null),
    upsert: jest.fn(async ({ create, update }: any) => ({ clerkUserId: create.clerkUserId, ...create, ...update })),
  };
  const auditService: any = { write: jest.fn(async () => ({})) };
  const user: any = {
    findMany: jest.fn(async (): Promise<any[]> => []),
    findFirst: jest.fn(async (): Promise<any> => null),
    count: jest.fn(async (): Promise<number> => 0),
  };
  const db: any = { communicationConsent, user };

  const clerk: any = {
    users: {
      getUserList: jest.fn(async () => ({ data: [], totalCount: 0 })),
      getUser: jest.fn(async (id: string) => ({
        id,
        firstName: 'Jane',
        lastName: 'Doe',
        emailAddresses: [{ emailAddress: 'jane@clerk.com' }],
        phoneNumbers: [{ phoneNumber: '+254700000000' }],
        imageUrl: 'img',
        banned: false,
        lastActiveAt: '2026-01-01T00:00:00.000Z',
        createdAt: '2025-01-01T00:00:00.000Z',
      })),
    },
  };
  mockedCreateClerkClient.mockReturnValue(clerk);

  const service = new DirectoryService(
    { db } as unknown as PrismaService,
    { get: jest.fn(() => 'sk_test') } as unknown as ConfigService,
    auditService as unknown as AdminAuditService,
  );
  return { service, communicationConsent, user, clerk, auditService };
}

describe('DirectoryService', () => {
  beforeEach(() => mockedCreateClerkClient.mockReset());

  describe('listUsers', () => {
    it('enriches Clerk users with consent status and primary org', async () => {
      const { service, communicationConsent, user, clerk } = build();
      clerk.users.getUserList.mockResolvedValue({
        data: [
          {
            id: 'cler_1',
            firstName: 'Jane',
            lastName: 'Doe',
            emailAddresses: [{ emailAddress: 'jane@x.com' }],
            phoneNumbers: [{ phoneNumber: '+254700' }],
            imageUrl: 'img',
            banned: false,
            lastActiveAt: '2026-01-01T00:00:00.000Z',
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
        totalCount: 1,
      });
      communicationConsent.findMany.mockResolvedValue([
        { clerkUserId: 'cler_1', emailStatus: 'OPTED_OUT', smsStatus: 'OPTED_IN' },
      ]);
      user.findMany.mockResolvedValue([
        {
          clerkId: 'cler_1',
          memberships: [
            { role: 'OWNER', organization: { id: 'org_1', name: 'Acme', businessType: 'RETAIL' } },
          ],
        },
      ]);

      const result = await service.listUsers('jane', 50, 10);

      expect(result.total).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(10);
      expect(result.users[0]).toMatchObject({
        clerkId: 'cler_1',
        name: 'Jane Doe',
        emailStatus: 'OPTED_OUT',
        smsStatus: 'OPTED_IN',
        primaryOrg: { id: 'org_1', name: 'Acme', role: 'OWNER' },
      });
      expect(clerk.users.getUserList).toHaveBeenCalledWith({ limit: 50, offset: 10, query: 'jane' });
    });

    it('falls back to the local DB when Clerk is unavailable', async () => {
      const { service, user, clerk } = build();
      clerk.users.getUserList.mockRejectedValueOnce(new Error('clerk down'));
      user.findMany.mockResolvedValue([
        {
          clerkId: 'cler_1',
          name: 'Local Jane',
          email: 'jane@local.com',
          phone: null,
          createdAt: new Date('2025-01-01T00:00:00.000Z'),
          memberships: [],
        },
      ]);
      user.count.mockResolvedValue(1);

      const result = await service.listUsers();

      expect(result.total).toBe(1);
      expect(result.users[0]).toMatchObject({ name: 'Local Jane', email: 'jane@local.com' });
    });
  });

  describe('getUser', () => {
    it('merges Clerk identity with local membership and consent', async () => {
      const { service, communicationConsent, user } = build();
      user.findFirst.mockResolvedValue({
        clerkId: 'cler_1',
        name: 'Local Jane',
        email: 'jane@local.com',
        phone: null,
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        memberships: [
          { role: 'MANAGER', organization: { id: 'org_1', name: 'Acme', businessType: 'RETAIL' } },
        ],
      });
      communicationConsent.findUnique.mockResolvedValue({ emailStatus: 'OPTED_OUT', smsStatus: 'OPTED_OUT' });

      const result = await service.getUser('cler_1');

      expect(result).toMatchObject({
        name: 'Jane Doe',
        email: 'jane@clerk.com',
        emailStatus: 'OPTED_OUT',
        primaryOrg: { id: 'org_1', role: 'MANAGER' },
      });
    });

    it('throws NotFound when neither Clerk nor the local DB has the user', async () => {
      const { service, clerk } = build();
      clerk.users.getUser.mockRejectedValueOnce(new Error('not found'));

      await expect(service.getUser('ghost')).rejects.toThrow(NotFoundException);
    });

    it('falls back to local data when Clerk fails', async () => {
      const { service, clerk, user } = build();
      clerk.users.getUser.mockRejectedValueOnce(new Error('down'));
      user.findFirst.mockResolvedValue({
        clerkId: 'cler_1',
        name: 'Local Only',
        email: 'local@x.com',
        phone: '+254711',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        memberships: [],
      });

      const result = await service.getUser('cler_1');

      expect(result).toMatchObject({ name: 'Local Only', email: 'local@x.com', phone: '+254711' });
    });
  });

  describe('updateConsent', () => {
    it('upserts consent and audits before/after when an admin is supplied', async () => {
      const { service, communicationConsent, auditService } = build();
      communicationConsent.findUnique.mockResolvedValue({ emailStatus: 'OPTED_IN', smsStatus: 'OPTED_IN' });
      communicationConsent.upsert.mockResolvedValue({ clerkUserId: 'cler_1', emailStatus: 'OPTED_OUT', smsStatus: 'OPTED_IN' });

      await service.updateConsent('cler_1', 'OPTED_OUT', undefined, adminUser, '1.2.3.4');

      expect(communicationConsent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clerkUserId: 'cler_1' } }),
      );
      expect(auditService.write).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'consent.update',
          targetId: 'cler_1',
          ipAddress: '1.2.3.4',
          metadata: expect.objectContaining({
            before: { emailStatus: 'OPTED_IN', smsStatus: 'OPTED_IN' },
            after: { emailStatus: 'OPTED_OUT', smsStatus: 'OPTED_IN' },
          }),
        }),
      );
    });

    it('creates a default opted-in consent row when none existed', async () => {
      const { service, communicationConsent } = build();
      communicationConsent.findUnique.mockResolvedValue(null);

      await service.updateConsent('cler_1', undefined, 'OPTED_OUT');

      expect(communicationConsent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: { clerkUserId: 'cler_1', emailStatus: 'OPTED_IN', smsStatus: 'OPTED_OUT' },
        }),
      );
    });
  });

  describe('exportUsersCsv', () => {
    it('emits a header plus one quoted row per user', async () => {
      const { service, user, clerk } = build();
      clerk.users.getUserList.mockResolvedValue({
        data: [
          {
            id: 'cler_1',
            firstName: 'Jane',
            lastName: 'Doe',
            emailAddresses: [{ emailAddress: 'jane@x.com' }],
            phoneNumbers: [],
            imageUrl: null,
            banned: false,
            lastActiveAt: null,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
        totalCount: 1,
      });
      user.findMany.mockResolvedValue([]);

      const csv = await service.exportUsersCsv();

      const lines = csv.split('\n');
      expect(lines[0]).toContain('"Clerk ID"');
      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain('"cler_1"');
      expect(lines[1]).toContain('"Jane Doe"');
    });
  });
});
