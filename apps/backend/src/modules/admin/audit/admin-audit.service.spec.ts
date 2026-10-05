import * as crypto from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AdminAuditService } from './admin-audit.service';

function build() {
  const adminAuditLog: any = {
    create: jest.fn(async ({ data }: any): Promise<any> => ({
      id: 'log_1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      ...data,
    })),
    findMany: jest.fn(async (): Promise<any[]> => []),
    count: jest.fn(async (): Promise<number> => 0),
  };
  const adminUser: any = { findMany: jest.fn(async (): Promise<any[]> => []) };
  const db: any = { adminAuditLog, adminUser };
  return {
    service: new AdminAuditService({ db } as unknown as PrismaService),
    adminAuditLog,
    adminUser,
  };
}

describe('AdminAuditService', () => {
  describe('write', () => {
    it('persists the audit row and normalises missing optionals to null', async () => {
      const { service, adminAuditLog } = build();

      await service.write({
        adminId: 'adm_1',
        actionType: 'FREEZE_ACCOUNT',
        targetType: 'ORGANIZATION',
        targetId: 'org_1',
      });

      expect(adminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminId: 'adm_1',
          actionType: 'FREEZE_ACCOUNT',
          targetType: 'ORGANIZATION',
          targetId: 'org_1',
          targetLabel: null,
          reason: null,
          ipAddress: null,
          userAgent: null,
        }),
      });
    });

    it('rethrows when the audit write fails (never fail silently)', async () => {
      const { service, adminAuditLog } = build();
      adminAuditLog.create.mockRejectedValueOnce(new Error('db down'));

      await expect(
        service.write({ adminId: 'adm_1', actionType: 'X', targetType: 'Y' }),
      ).rejects.toThrow('db down');
    });
  });

  describe('findLogs', () => {
    it('applies every filter and clamps the page size to 100', async () => {
      const { service, adminAuditLog } = build();
      adminAuditLog.findMany.mockResolvedValue([{ id: 'log_1' }]);
      adminAuditLog.count.mockResolvedValue(1);

      const result = await service.findLogs({
        adminId: 'adm_1',
        actionType: 'FREEZE',
        targetType: 'ORG',
        targetId: 'org_1',
        limit: 500,
        offset: 10,
      });

      expect(adminAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { adminId: 'adm_1', actionType: 'FREEZE', targetType: 'ORG', targetId: 'org_1' },
          take: 100,
          skip: 10,
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result).toEqual({ items: [{ id: 'log_1' }], total: 1, limit: 100, offset: 10 });
    });

    it('defaults to 50 rows and builds an insensitive OR search', async () => {
      const { service, adminAuditLog } = build();

      await service.findLogs({ search: '  freeze  ' });

      const args = adminAuditLog.findMany.mock.calls[0][0];
      expect(args.take).toBe(50);
      expect(args.skip).toBe(0);
      expect(args.where.OR).toEqual([
        { actionType: { contains: 'freeze', mode: 'insensitive' } },
        { targetLabel: { contains: 'freeze', mode: 'insensitive' } },
        { reason: { contains: 'freeze', mode: 'insensitive' } },
      ]);
    });

    it('builds a createdAt range when from/to are supplied', async () => {
      const { service, adminAuditLog } = build();

      await service.findLogs({ from: '2026-01-01', to: '2026-02-01' });

      const args = adminAuditLog.findMany.mock.calls[0][0];
      expect(args.where.createdAt.gte).toEqual(new Date('2026-01-01'));
      expect(args.where.createdAt.lte).toEqual(new Date('2026-02-01'));
    });
  });

  describe('getAuditMeta', () => {
    it('returns distinct action/target types and active admins', async () => {
      const { service, adminAuditLog, adminUser } = build();
      adminAuditLog.findMany
        .mockResolvedValueOnce([{ actionType: 'FREEZE' }, { actionType: 'UNFREEZE' }])
        .mockResolvedValueOnce([{ targetType: 'ORG' }, { targetType: 'USER' }]);
      adminUser.findMany.mockResolvedValue([{ id: 'adm_1', name: 'A', email: 'a@x.com' }]);

      const meta = await service.getAuditMeta();

      expect(meta).toEqual({
        actionTypes: ['FREEZE', 'UNFREEZE'],
        targetTypes: ['ORG', 'USER'],
        admins: [{ id: 'adm_1', name: 'A', email: 'a@x.com' }],
      });
      expect(adminUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });
  });

  describe('exportCsvWithChecksum', () => {
    it('escapes CSV quotes and emits a matching SHA-256 integrity hash', async () => {
      const { service, adminAuditLog } = build();
      adminAuditLog.findMany.mockResolvedValue([
        {
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          admin: { name: 'A "B"', email: 'a@x.com' },
          actionType: 'FREEZE',
          targetType: 'ORG',
          targetId: 'org_1',
          targetLabel: 'Acme "Ltd"',
          reason: 'fraud',
          ipAddress: '1.2.3.4',
        },
      ]);
      adminAuditLog.count.mockResolvedValue(1);

      const { csvContent, sha256, count } = await service.exportCsvWithChecksum({});

      expect(count).toBe(1);
      expect(csvContent).toContain('"A ""B"""');
      expect(csvContent).toContain('"Acme ""Ltd"""');

      const body = csvContent.replace(/\n\n# Integrity Checksum \(SHA-256\): [0-9a-f]{64}\n$/, '');
      const expected = crypto.createHash('sha256').update(body, 'utf8').digest('hex');
      expect(sha256).toBe(expected);
      expect(csvContent).toContain(`# Integrity Checksum (SHA-256): ${sha256}`);
    });
  });
});
