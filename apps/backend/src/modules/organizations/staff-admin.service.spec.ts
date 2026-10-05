import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import { PrismaService } from '../../infrastructure/prisma.service';
import { EntitlementsService } from '../../core/entitlements/entitlements.service';
import { StaffAdminService } from './staff-admin.service';

jest.mock('@clerk/backend', () => ({
  createClerkClient: jest.fn(),
}));

const mockedCreateClerkClient = createClerkClient as unknown as jest.Mock;
const ORG = 'org_1';

function build(
  opts: {
    ownerMembership?: any;
    callerMembership?: any;
    targetMembership?: any;
    members?: any[];
    targetUser?: any;
  } = {},
) {
  const orgMembership: any = {
    findFirst: jest.fn(async (args: any) => {
      const where = args?.where ?? {};
      if (where.role === 'OWNER') return opts.ownerMembership === undefined ? { id: 'm_owner', role: 'OWNER' } : opts.ownerMembership;
      if (where.role?.in) return opts.callerMembership === undefined ? { id: 'm_caller', role: 'OWNER' } : opts.callerMembership;
      return opts.targetMembership === undefined ? { id: 'm_target', userId: 'u_target', role: 'STAFF' } : opts.targetMembership;
    }),
    findMany: jest.fn(async (): Promise<any[]> => opts.members ?? []),
    update: jest.fn(async ({ where, data }: any) => ({
      id: where.id,
      userId: 'u_target',
      role: 'STAFF',
      user: { name: 'Jane', email: 'jane@x.com' },
      ...data,
    })),
    deleteMany: jest.fn(async () => ({ count: 1 })),
  };
  const user: any = {
    findUnique: jest.fn(async () => ('targetUser' in opts ? opts.targetUser : { clerkId: 'cler_target' })),
  };
  const db: any = { orgMembership, user };

  const clerk = {
    sessions: {
      getSessionList: jest.fn(async () => ({ data: [{ id: 'sess_1' }, { id: 'sess_2' }] })),
      revokeSession: jest.fn(async () => ({})),
    },
  };
  mockedCreateClerkClient.mockReturnValue(clerk);

  const entitlements: any = { syncSeatCount: jest.fn(async () => 1) };
  const service = new StaffAdminService(
    { db } as unknown as PrismaService,
    { get: jest.fn(() => 'sk_test') } as unknown as ConfigService,
    entitlements as unknown as EntitlementsService,
  );
  return { service, orgMembership, user, clerk, entitlements };
}

describe('StaffAdminService', () => {
  beforeEach(() => mockedCreateClerkClient.mockReset());

  describe('getStaffMembers', () => {
    it('denies callers who are not OWNER or MANAGER', async () => {
      const { service } = build({ callerMembership: null });

      await expect(service.getStaffMembers('u_staff', ORG)).rejects.toThrow(ForbiddenException);
    });

    it('returns members with computed effective permissions', async () => {
      const { service } = build({
        members: [
          {
            userId: 'u_target',
            role: 'STAFF',
            createdAt: new Date('2026-01-01'),
            grantedPermissions: ['canViewFinance'],
            revokedPermissions: ['canLogTransactions'],
            user: { id: 'u_target', clerkId: 'cler_target', name: 'Jane', email: 'jane@x.com' },
          },
        ],
      });

      const members = await service.getStaffMembers('u_owner', ORG);

      expect(members).toHaveLength(1);
      expect(members[0]).toMatchObject({ userId: 'u_target', name: 'Jane', role: 'STAFF' });
      // canViewFinance granted, canLogTransactions revoked.
      expect(members[0].effectivePermissions).toContain('canViewFinance');
      expect(members[0].effectivePermissions).not.toContain('canLogTransactions');
    });
  });

  describe('removeStaff', () => {
    it('denies non-owners', async () => {
      const { service } = build({ ownerMembership: null });

      await expect(service.removeStaff('u_manager', 'u_target', ORG)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('refuses to remove yourself', async () => {
      const { service } = build();

      await expect(service.removeStaff('u_target', 'u_target', ORG)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFound when the target is not in the org', async () => {
      const { service } = build({ targetMembership: null });

      await expect(service.removeStaff('u_owner', 'u_ghost', ORG)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes the membership, syncs seats, and revokes Clerk sessions', async () => {
      const { service, orgMembership, entitlements, clerk } = build();

      await service.removeStaff('u_owner', 'u_target', ORG);

      expect(orgMembership.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u_target', organizationId: ORG },
      });
      expect(entitlements.syncSeatCount).toHaveBeenCalledWith(ORG);
      expect(clerk.sessions.getSessionList).toHaveBeenCalledWith({ userId: 'cler_target', status: 'active' });
      expect(clerk.sessions.revokeSession).toHaveBeenCalledTimes(2);
    });

    it('does not fail when Clerk session revocation errors (membership already removed)', async () => {
      const { service, clerk } = build();
      clerk.sessions.getSessionList.mockRejectedValueOnce(new Error('clerk down'));

      await expect(service.removeStaff('u_owner', 'u_target', ORG)).resolves.toBeUndefined();
    });
  });

  describe('updatePermissions', () => {
    it('rejects invalid permission keys', async () => {
      const { service } = build();

      await expect(
        service.updatePermissions('u_owner', 'u_target', ORG, ['notARealPermission'], []),
      ).rejects.toThrow(BadRequestException);
    });

    it('never allows granting canManageStaff via override', async () => {
      const { service, orgMembership } = build();

      await expect(
        service.updatePermissions('u_owner', 'u_target', ORG, ['canManageStaff'], []),
      ).rejects.toThrow(BadRequestException);
      expect(orgMembership.update).not.toHaveBeenCalled();
    });

    it('throws NotFound when the target membership is missing', async () => {
      const { service } = build({ targetMembership: null });

      await expect(
        service.updatePermissions('u_owner', 'u_target', ORG, ['canViewFinance'], []),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates overrides and returns effective permissions', async () => {
      const { service, orgMembership } = build();

      const result = await service.updatePermissions(
        'u_owner',
        'u_target',
        ORG,
        ['canViewFinance'],
        ['canLogTransactions'],
      );

      expect(orgMembership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'm_target' },
          data: { grantedPermissions: ['canViewFinance'], revokedPermissions: ['canLogTransactions'] },
        }),
      );
      expect(result.effectivePermissions).toContain('canViewFinance');
      expect(result.effectivePermissions).not.toContain('canLogTransactions');
    });
  });
});
