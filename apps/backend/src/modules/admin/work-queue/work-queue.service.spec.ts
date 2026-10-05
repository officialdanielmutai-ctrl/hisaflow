import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AdminAuditService } from '../audit/admin-audit.service';
import { WorkQueueService } from './work-queue.service';

const adminUser = { id: 'adm_1', name: 'Admin One' } as any;

function build() {
  const adminWorkItem: any = {
    create: jest.fn(async ({ data }: any) => ({ id: 'wi_1', ...data })),
    findUnique: jest.fn(async (): Promise<any> => null),
    findMany: jest.fn(async (): Promise<any[]> => []),
    count: jest.fn(async (): Promise<number> => 0),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, title: 'Existing', ...data })),
  };
  const adminUserDelegate: any = {
    findUnique: jest.fn(async () => ({ id: 'adm_2', name: 'Bob' })),
    findMany: jest.fn(async (): Promise<any[]> => []),
  };
  const db: any = { adminWorkItem, adminUser: adminUserDelegate };
  const auditService = { write: jest.fn(async () => ({})) };
  const service = new WorkQueueService(
    { db } as unknown as PrismaService,
    auditService as unknown as AdminAuditService,
  );
  return { service, adminWorkItem, adminUserDelegate, auditService };
}

describe('WorkQueueService', () => {
  describe('create', () => {
    it('defaults priority to MEDIUM, status to OPEN and resolves the assignee name', async () => {
      const { service, adminWorkItem, adminUserDelegate, auditService } = build();

      await service.create(
        { title: 'Fix billing', assignedToAdminId: 'adm_2' } as any,
        adminUser,
        '1.2.3.4',
      );

      expect(adminUserDelegate.findUnique).toHaveBeenCalledWith({ where: { id: 'adm_2' } });
      expect(adminWorkItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Fix billing',
          priority: 'MEDIUM',
          status: 'OPEN',
          assignedToAdminName: 'Bob',
          createdByAdminId: 'adm_1',
          createdByAdminName: 'Admin One',
        }),
      });
      expect(auditService.write).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'work_item.create', targetId: 'wi_1', ipAddress: '1.2.3.4' }),
      );
    });

    it('does not look up the assignee when a name is supplied', async () => {
      const { service, adminUserDelegate } = build();

      await service.create({ title: 'Task', assignedToAdminId: 'adm_2', assignedToAdminName: 'Bobby' } as any, adminUser);

      expect(adminUserDelegate.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('filters, clamps limit to 100 and paginates', async () => {
      const { service, adminWorkItem } = build();
      adminWorkItem.findMany.mockResolvedValue([{ id: 'wi_1' }]);
      adminWorkItem.count.mockResolvedValue(1);

      const result = await service.findAll({
        status: 'OPEN',
        priority: 'HIGH',
        assignedToAdminId: 'adm_1',
        organizationId: 'org_1',
        limit: 500,
        page: 2,
      } as any);

      expect(adminWorkItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'OPEN', priority: 'HIGH', assignedToAdminId: 'adm_1', organizationId: 'org_1' },
          take: 100,
          skip: 200,
        }),
      );
      expect(result.limit).toBe(100);
      expect(result.page).toBe(2);
    });

    it('builds an insensitive multi-field search', async () => {
      const { service, adminWorkItem } = build();

      await service.findAll({ search: '  billing  ' } as any);

      const args = adminWorkItem.findMany.mock.calls[0][0];
      expect(args.where.OR).toEqual([
        { title: { contains: 'billing', mode: 'insensitive' } },
        { description: { contains: 'billing', mode: 'insensitive' } },
        { organizationName: { contains: 'billing', mode: 'insensitive' } },
      ]);
    });
  });

  describe('findOne', () => {
    it('throws NotFound for a missing item', async () => {
      const { service } = build();

      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('throws NotFound when the item does not exist', async () => {
      const { service, adminWorkItem } = build();
      adminWorkItem.findUnique.mockResolvedValue(null);

      await expect(service.update('nope', { title: 'x' } as any, adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuses to resolve without a resolution note (invariant)', async () => {
      const { service, adminWorkItem } = build();
      adminWorkItem.findUnique.mockResolvedValue({
        id: 'wi_1',
        status: 'OPEN',
        priority: 'MEDIUM',
        assignedToAdminName: null,
        resolutionNote: null,
        title: 'T',
      });

      await expect(
        service.update('wi_1', { status: 'RESOLVED' } as any, adminUser),
      ).rejects.toThrow(BadRequestException);
      expect(adminWorkItem.update).not.toHaveBeenCalled();
    });

    it('stamps resolvedAt and audits a status change to RESOLVED', async () => {
      const { service, adminWorkItem, auditService } = build();
      adminWorkItem.findUnique.mockResolvedValue({
        id: 'wi_1',
        status: 'OPEN',
        priority: 'MEDIUM',
        assignedToAdminName: null,
        resolutionNote: null,
        title: 'T',
      });

      await service.update('wi_1', { status: 'RESOLVED', resolutionNote: 'done' } as any, adminUser);

      expect(adminWorkItem.update).toHaveBeenCalledWith({
        where: { id: 'wi_1' },
        data: expect.objectContaining({ status: 'RESOLVED', resolvedAt: expect.any(Date), resolutionNote: 'done' }),
      });
      expect(auditService.write).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'work_item.status_change' }),
      );
    });

    it('reassigns and resolves the new assignee name', async () => {
      const { service, adminWorkItem, adminUserDelegate, auditService } = build();
      adminWorkItem.findUnique.mockResolvedValue({
        id: 'wi_1',
        status: 'OPEN',
        priority: 'MEDIUM',
        assignedToAdminId: 'adm_old',
        assignedToAdminName: 'Alice',
        title: 'T',
      });

      await service.update('wi_1', { assignedToAdminId: 'adm_2' } as any, adminUser);

      expect(adminUserDelegate.findUnique).toHaveBeenCalledWith({ where: { id: 'adm_2' } });
      expect(adminWorkItem.update).toHaveBeenCalledWith({
        where: { id: 'wi_1' },
        data: expect.objectContaining({ assignedToAdminId: 'adm_2', assignedToAdminName: 'Bob' }),
      });
      expect(auditService.write).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'work_item.reassign' }),
      );
    });

    it('audits a plain edit as work_item.update', async () => {
      const { service, adminWorkItem, auditService } = build();
      adminWorkItem.findUnique.mockResolvedValue({
        id: 'wi_1',
        status: 'OPEN',
        priority: 'MEDIUM',
        assignedToAdminName: null,
        title: 'T',
      });

      await service.update('wi_1', { title: 'New title' } as any, adminUser);

      expect(auditService.write).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'work_item.update' }),
      );
    });
  });

  describe('listAdmins', () => {
    it('returns active admins ordered by name', async () => {
      const { service, adminUserDelegate } = build();

      await service.listAdmins();

      expect(adminUserDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      );
    });
  });
});
