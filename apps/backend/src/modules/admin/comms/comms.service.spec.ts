import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AdminAuditService } from '../audit/admin-audit.service';
import { CommsService } from './comms.service';

const adminUser = { id: 'adm_1', name: 'Admin One' } as any;
const savedResendKey = process.env.RESEND_API_KEY;
const savedAtKey = process.env.AFRICASTALKING_API_KEY;

function build() {
  const communicationConsent: any = {
    findMany: jest.fn(async (): Promise<any[]> => []),
    count: jest.fn(async (): Promise<number> => 0),
  };
  const user: any = { findMany: jest.fn(async (): Promise<any[]> => []) };
  const bulkSendLog: any = {
    create: jest.fn(async ({ data }: any) => ({ id: 'bsl_1', sentAt: null, ...data })),
    update: jest.fn(async ({ where, data }: any) => ({
      id: where.id,
      recipientCount: 1,
      successCount: 1,
      failureCount: 0,
      sentAt: new Date(),
      ...data,
    })),
    findMany: jest.fn(async (): Promise<any[]> => []),
    count: jest.fn(async (): Promise<number> => 0),
  };
  const campaignDelivery: any = { create: jest.fn(async ({ data }: any) => ({ id: 'cd_1', ...data })) };
  const db: any = { communicationConsent, user, bulkSendLog, campaignDelivery };
  const auditService: any = { write: jest.fn(async () => ({})) };

  const service = new CommsService(
    { db } as unknown as PrismaService,
    { get: jest.fn(() => undefined) } as unknown as ConfigService,
    auditService as unknown as AdminAuditService,
  );
  return { service, communicationConsent, user, bulkSendLog, campaignDelivery, auditService };
}

describe('CommsService', () => {
  beforeAll(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.AFRICASTALKING_API_KEY;
  });

  afterAll(() => {
    if (savedResendKey !== undefined) process.env.RESEND_API_KEY = savedResendKey;
    if (savedAtKey !== undefined) process.env.AFRICASTALKING_API_KEY = savedAtKey;
  });

  describe('preview — consent gate', () => {
    it('only resolves email recipients from OPTED_IN consent rows', async () => {
      const { service, communicationConsent, user } = build();
      communicationConsent.findMany.mockResolvedValue([
        { clerkUserId: 'cler_1', email: 'jane@x.com' },
      ]);
      user.findMany.mockResolvedValue([
        {
          clerkId: 'cler_1',
          name: 'Jane',
          email: 'jane@x.com',
          memberships: [{ organization: { name: 'Acme', businessType: 'RETAIL' } }],
        },
      ]);
      communicationConsent.count.mockResolvedValue(3);

      const result = await service.preview({ channel: 'EMAIL', body: 'Hello there' } as any);

      expect(communicationConsent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { emailStatus: 'OPTED_IN' } }),
      );
      expect(result.recipientCount).toBe(1);
      expect(result.excludedCount).toBe(3);
      expect(result.totalAudience).toBe(4);
      expect(result.filterSummary).toBe('all opted-in users');
    });

    it('only resolves SMS recipients from OPTED_IN consent rows', async () => {
      const { service, communicationConsent, user } = build();
      communicationConsent.findMany.mockResolvedValue([{ clerkUserId: 'cler_1', phone: null }]);
      user.findMany.mockResolvedValue([
        {
          clerkId: 'cler_1',
          name: 'Jane',
          phone: '0712345678',
          memberships: [{ organization: { name: 'Acme' } }],
        },
      ]);

      const result = await service.preview({ channel: 'SMS', body: 'Hello there' } as any);

      expect(communicationConsent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { smsStatus: 'OPTED_IN' } }),
      );
      expect(result.recipientCount).toBe(1);
      expect(result.estimatedCost).toContain("Africa's Talking");
    });

    it('bypasses the consent lookup when explicit emails are provided', async () => {
      const { service, communicationConsent } = build();

      await service.preview({ channel: 'EMAIL', body: 'Hello there', specificEmails: ['a@x.com'] } as any);

      expect(communicationConsent.findMany).not.toHaveBeenCalled();
    });
  });

  describe('dispatch — validation', () => {
    it('requires a subject for email sends', async () => {
      const { service } = build();

      await expect(service.dispatch({ channel: 'EMAIL', body: 'Hello there' } as any, adminUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects when no opted-in recipients match the filters', async () => {
      const { service, communicationConsent, user } = build();
      communicationConsent.findMany.mockResolvedValue([]);
      user.findMany.mockResolvedValue([]);

      await expect(
        service.dispatch({ channel: 'EMAIL', subject: 'Hi', body: 'Hello there' } as any, adminUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('dispatch — email', () => {
    it('records a delivery per recipient and marks the batch SENT', async () => {
      const { service, communicationConsent, user, bulkSendLog, campaignDelivery, auditService } = build();
      communicationConsent.findMany.mockResolvedValue([{ clerkUserId: 'cler_1', email: 'jane@x.com' }]);
      user.findMany.mockResolvedValue([
        {
          clerkId: 'cler_1',
          name: 'Jane',
          email: 'jane@x.com',
          memberships: [{ organization: { name: 'Acme' } }],
        },
      ]);

      const result = await service.dispatch(
        { channel: 'EMAIL', subject: 'Hi', body: 'Hello there' } as any,
        adminUser,
      );

      expect(bulkSendLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'SENDING', recipientCount: 1 }) }),
      );
      expect(campaignDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ recipient: 'jane@x.com', channel: 'EMAIL', status: 'DELIVERED' }),
        }),
      );
      expect(result.status).toBe('SENT');
      expect(auditService.write).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'comms.bulk_send' }),
      );
    });
  });

  describe('dispatch — SMS', () => {
    it('normalises local Kenyan numbers before recording delivery', async () => {
      const { service, communicationConsent, user, campaignDelivery } = build();
      communicationConsent.findMany.mockResolvedValue([{ clerkUserId: 'cler_1', phone: null }]);
      user.findMany.mockResolvedValue([
        {
          clerkId: 'cler_1',
          name: 'Jane',
          phone: '0712345678',
          memberships: [{ organization: { name: 'Acme' } }],
        },
      ]);

      await service.dispatch({ channel: 'SMS', body: 'Hello there' } as any, adminUser);

      expect(campaignDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ recipient: '+254712345678', channel: 'SMS' }),
        }),
      );
    });

    it('marks the batch FAILED and rethrows when delivery persistence throws', async () => {
      const { service, communicationConsent, user, bulkSendLog, campaignDelivery } = build();
      communicationConsent.findMany.mockResolvedValue([{ clerkUserId: 'cler_1', phone: '254700000000' }]);
      user.findMany.mockResolvedValue([
        { clerkId: 'cler_1', name: 'Jane', phone: '254700000000', memberships: [] },
      ]);
      campaignDelivery.create.mockRejectedValueOnce(new Error('db write fail'));

      await expect(
        service.dispatch({ channel: 'SMS', body: 'Hello there' } as any, adminUser),
      ).rejects.toThrow(InternalServerErrorException);
      expect(bulkSendLog.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'FAILED' } }),
      );
    });
  });

  describe('getHistory', () => {
    it('clamps the page size and paginates', async () => {
      const { service, bulkSendLog } = build();

      const result = await service.getHistory(1, 500);

      expect(bulkSendLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100, skip: 100 }),
      );
      expect(result.limit).toBe(100);
    });
  });
});
