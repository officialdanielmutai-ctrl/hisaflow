import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AdminAuditService } from '../audit/admin-audit.service';
import { MessagesService } from './messages.service';

const ORG = 'org_1';
const adminUser = { id: 'adm_1', name: 'Admin One' } as any;

function build() {
  const organization: any = {
    findUnique: jest.fn(async () => ({ id: ORG, name: 'Acme', createdAt: new Date() })),
  };
  const messageAccessLog: any = {
    create: jest.fn(async ({ data }: any) => ({ id: 'log_1', accessedAt: new Date(), ...data })),
    findMany: jest.fn(async (): Promise<any[]> => []),
  };
  const alert: any = { findMany: jest.fn(async (): Promise<any[]> => []) };
  const note: any = { findMany: jest.fn(async (): Promise<any[]> => []) };
  const db: any = { organization, messageAccessLog, alert, note };
  const auditService: any = { write: jest.fn(async () => ({})) };

  const service = new MessagesService(
    { db } as unknown as PrismaService,
    { get: jest.fn(() => 'unit-test-message-secret-32bytes') } as unknown as ConfigService,
    auditService as unknown as AdminAuditService,
  );
  return { service, organization, messageAccessLog, alert, note, auditService };
}

describe('MessagesService', () => {
  describe('requestAccess', () => {
    it('throws NotFound for an unknown org', async () => {
      const { service, organization } = build();
      organization.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.requestAccess({ orgId: 'nope', reason: 'support' } as any, adminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('records the mandatory reason, audits it, and issues a session token', async () => {
      const { service, messageAccessLog, auditService } = build();

      const result = await service.requestAccess(
        { orgId: ORG, reason: 'support', reasonNote: 'ticket 42' } as any,
        adminUser,
        '1.2.3.4',
      );

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeTruthy();
      expect(result.expiresInSeconds).toBe(1800);
      expect(messageAccessLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ adminId: 'adm_1', orgId: ORG, accessReason: 'support' }),
        }),
      );
      expect(auditService.write).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'message.view',
          targetId: ORG,
          metadata: expect.objectContaining({ validityMinutes: 30 }),
        }),
      );
    });
  });

  describe('token enforcement', () => {
    it('rejects an empty token with the mandatory-reason error', async () => {
      const { service } = build();

      await expect(service.listConversations(ORG, '')).rejects.toThrow(ForbiddenException);
    });

    it('rejects a corrupt token', async () => {
      const { service } = build();

      await expect(service.listConversations(ORG, 'garbage')).rejects.toThrow(ForbiddenException);
    });

    it('rejects a token issued for a different organisation', async () => {
      const { service } = build();
      const token = (await service.requestAccess({ orgId: ORG, reason: 'r' } as any, adminUser)).accessToken;

      await expect(service.listConversations('org_other', token)).rejects.toThrow(ForbiddenException);
    });

    it('accepts a token generated for the org and returns synthesised channels', async () => {
      const { service, alert, note } = build();
      const token = (await service.requestAccess({ orgId: ORG, reason: 'r' } as any, adminUser)).accessToken;
      alert.findMany.mockResolvedValue([
        { id: 'a1', title: 'Low stock', description: 'Milk low', severity: 'WARNING', createdAt: new Date('2026-01-01') },
      ]);
      note.findMany.mockResolvedValue([
        { id: 'n1', content: 'Call supplier', createdAt: new Date('2026-01-02') },
      ]);

      const channels = await service.listConversations(ORG, token);

      expect(channels).toHaveLength(3);
      expect(channels[0].id).toBe('conv-ai-ingestion');
      expect(channels[1].lastMessageSnippet).toBe('Milk low');
      expect(channels[2].lastMessageSnippet).toBe('Call supplier');
      expect(alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: ORG } }),
      );
    });
  });

  describe('getConversationMessages', () => {
    async function withToken() {
      const built = build();
      const token = (await built.service.requestAccess({ orgId: ORG, reason: 'r' } as any, adminUser)).accessToken;
      return { ...built, token };
    }

    it('maps alerts into SMS dispatch messages', async () => {
      const { service, token, alert } = await withToken();
      alert.findMany.mockResolvedValue([
        { id: 'a1', title: 'Low', description: 'desc', severity: 'WARNING', createdAt: new Date('2026-01-01') },
      ]);

      const messages = await service.getConversationMessages(ORG, 'conv-alerts-broadcast', token);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        id: 'msg-alert-a1',
        channel: 'SMS',
        metadata: { alertId: 'a1', severity: 'WARNING' },
      });
    });

    it('falls back to a default dispatch when there are no alerts', async () => {
      const { service, token, alert } = await withToken();
      alert.findMany.mockResolvedValue([]);

      const messages = await service.getConversationMessages(ORG, 'conv-alerts-broadcast', token);

      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('msg-alert-default');
    });

    it('returns the AI ingestion thread and the support thread', async () => {
      const { service, token } = await withToken();

      const ai = await service.getConversationMessages(ORG, 'conv-ai-ingestion', token);
      const support = await service.getConversationMessages(ORG, 'conv-support-desk', token);

      expect(ai.length).toBeGreaterThanOrEqual(4);
      expect(ai.some((m) => m.senderType === 'AI_SYSTEM')).toBe(true);
      expect(support).toHaveLength(2);
    });
  });

  describe('getAccessLogs', () => {
    it('returns the 50 most recent access logs', async () => {
      const { service, messageAccessLog } = build();

      await service.getAccessLogs();

      expect(messageAccessLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50, orderBy: { accessedAt: 'desc' } }),
      );
    });
  });
});
