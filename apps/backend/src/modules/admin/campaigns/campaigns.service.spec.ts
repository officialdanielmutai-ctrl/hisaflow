import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AdminAuditService } from '../audit/admin-audit.service';
import { CommsService } from '../comms/comms.service';
import { CampaignsService } from './campaigns.service';

const adminUser = { id: 'adm_1', name: 'Admin One' } as any;
const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

function build() {
  const marketingCampaign: any = {
    create: jest.fn(async ({ data }: any) => ({ id: 'camp_1', ...data })),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, name: 'Camp', ...data })),
    findUnique: jest.fn(async (): Promise<any> => null),
    findMany: jest.fn(async (): Promise<any[]> => []),
    count: jest.fn(async (): Promise<number> => 0),
  };
  const db: any = { marketingCampaign };
  const auditService: any = { write: jest.fn(async () => ({})) };
  const commsService: any = {
    dispatch: jest.fn(async () => ({ recipientCount: 10, successCount: 9, failureCount: 1 })),
    preview: jest.fn(async () => ({ recipientCount: 5 })),
  };

  const service = new CampaignsService(
    { db } as unknown as PrismaService,
    auditService as unknown as AdminAuditService,
    commsService as unknown as CommsService,
  );
  return { service, marketingCampaign, auditService, commsService };
}

describe('CampaignsService', () => {
  describe('create', () => {
    it('creates a DRAFT when no schedule is set and audits it', async () => {
      const { service, marketingCampaign, auditService } = build();

      await service.create({ name: 'Promo', channel: 'EMAIL', body: 'Hi' } as any, adminUser);

      expect(marketingCampaign.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Promo', status: 'DRAFT' }) }),
      );
      expect(auditService.write).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'campaign.create' }),
      );
    });

    it('creates a SCHEDULED campaign for a future date', async () => {
      const { service, marketingCampaign } = build();

      await service.create({ name: 'Promo', channel: 'SMS', body: 'Hi', scheduledAt: future } as any, adminUser);

      expect(marketingCampaign.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'SCHEDULED' }) }),
      );
    });
  });

  describe('update', () => {
    it('throws NotFound when the campaign is absent', async () => {
      const { service } = build();

      await expect(service.update('nope', { name: 'x' } as any, adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuses to edit a completed campaign', async () => {
      const { service, marketingCampaign } = build();
      marketingCampaign.findUnique.mockResolvedValue({ id: 'camp_1', status: 'COMPLETED' });

      await expect(service.update('camp_1', { name: 'x' } as any, adminUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('re-schedules and audits before/after when a future date is supplied', async () => {
      const { service, marketingCampaign, auditService } = build();
      marketingCampaign.findUnique.mockResolvedValue({ id: 'camp_1', status: 'DRAFT' });

      await service.update('camp_1', { scheduledAt: future } as any, adminUser);

      expect(marketingCampaign.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'SCHEDULED' }) }),
      );
      expect(auditService.write).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'campaign.update',
          metadata: expect.objectContaining({ before: expect.anything(), after: expect.anything() }),
        }),
      );
    });
  });

  describe('findAll / findOne', () => {
    it('clamps the page size and filters by status', async () => {
      const { service, marketingCampaign } = build();

      const result = await service.findAll('DRAFT' as any, 1, 500);

      expect(marketingCampaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'DRAFT' }, take: 100, skip: 100 }),
      );
      expect(result.limit).toBe(100);
    });

    it('throws NotFound for a missing campaign', async () => {
      const { service } = build();

      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('refuses to cancel a completed campaign', async () => {
      const { service, marketingCampaign } = build();
      marketingCampaign.findUnique.mockResolvedValue({ id: 'camp_1', status: 'COMPLETED' });

      await expect(service.cancel('camp_1', adminUser)).rejects.toThrow(BadRequestException);
    });

    it('cancels and audits the previous status', async () => {
      const { service, marketingCampaign, auditService } = build();
      marketingCampaign.findUnique.mockResolvedValue({ id: 'camp_1', name: 'Promo', status: 'SCHEDULED' });

      await service.cancel('camp_1', adminUser);

      expect(marketingCampaign.update).toHaveBeenCalledWith({
        where: { id: 'camp_1' },
        data: { status: 'CANCELLED' },
      });
      expect(auditService.write).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'campaign.cancel', metadata: { previousStatus: 'SCHEDULED' } }),
      );
    });
  });

  describe('executeNow', () => {
    const draftCampaign = {
      id: 'camp_1',
      name: 'Promo',
      status: 'DRAFT',
      channel: 'EMAIL',
      subject: 'Hello',
      body: 'Body',
      segmentCriteria: { businessTypes: ['RETAIL'] },
    };

    it('dispatches, marks COMPLETED with counts, and audits', async () => {
      const { service, marketingCampaign, commsService, auditService } = build();
      marketingCampaign.findUnique.mockResolvedValue(draftCampaign);

      const result = await service.executeNow('camp_1', adminUser);

      expect(commsService.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'EMAIL', businessTypes: ['RETAIL'] }),
        adminUser,
        undefined,
        undefined,
      );
      expect(marketingCampaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            recipientCount: 10,
            deliveredCount: 9,
            failedCount: 1,
          }),
        }),
      );
      expect(auditService.write).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'campaign.execute' }),
      );
      expect(result.status).toBe('COMPLETED');
    });

    it('resets to DRAFT and rethrows when dispatch fails', async () => {
      const { service, marketingCampaign, commsService } = build();
      marketingCampaign.findUnique.mockResolvedValue(draftCampaign);
      commsService.dispatch.mockRejectedValueOnce(new Error('resend down'));

      await expect(service.executeNow('camp_1', adminUser)).rejects.toThrow('resend down');
      expect(marketingCampaign.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: { status: 'DRAFT' } }),
      );
    });

    it('refuses to execute a completed campaign', async () => {
      const { service, marketingCampaign, commsService } = build();
      marketingCampaign.findUnique.mockResolvedValue({ ...draftCampaign, status: 'COMPLETED' });

      await expect(service.executeNow('camp_1', adminUser)).rejects.toThrow(BadRequestException);
      expect(commsService.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('estimateReach', () => {
    it('delegates to the comms preview', async () => {
      const { service, commsService } = build();

      const result = await service.estimateReach({ businessTypes: ['RETAIL'] } as any, 'SMS' as any);

      expect(commsService.preview).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'SMS', businessTypes: ['RETAIL'] }),
      );
      expect(result).toEqual({ recipientCount: 5 });
    });
  });

  describe('handleResendWebhook', () => {
    it('increments openedCount on the most recent completed campaign', async () => {
      const { service, marketingCampaign } = build();
      marketingCampaign.findMany.mockResolvedValue([{ id: 'camp_1' }]);

      const result = await service.handleResendWebhook({ type: 'email.opened', data: { to: ['a@x.com'] } });

      expect(marketingCampaign.update).toHaveBeenCalledWith({
        where: { id: 'camp_1' },
        data: { openedCount: { increment: 1 } },
      });
      expect(result).toEqual({ received: true });
    });

    it('increments clickedCount on click events', async () => {
      const { service, marketingCampaign } = build();
      marketingCampaign.findMany.mockResolvedValue([{ id: 'camp_1' }]);

      await service.handleResendWebhook({ type: 'email.clicked', data: { to: ['a@x.com'] } });

      expect(marketingCampaign.update).toHaveBeenCalledWith({
        where: { id: 'camp_1' },
        data: { clickedCount: { increment: 1 } },
      });
    });

    it('ignores unrelated event types', async () => {
      const { service, marketingCampaign } = build();

      await service.handleResendWebhook({ type: 'email.delivered', data: { to: ['a@x.com'] } });

      expect(marketingCampaign.update).not.toHaveBeenCalled();
    });
  });
});
