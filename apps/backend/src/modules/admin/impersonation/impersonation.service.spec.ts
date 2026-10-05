import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AdminAuditService } from '../audit/admin-audit.service';
import { ImpersonationService } from './impersonation.service';

const SECRET = 'unit-test-impersonation-secret';
const ORG = 'org_1';

function build() {
  let record: any = null;

  const organization: any = {
    findUnique: jest.fn(async () => ({ id: ORG, name: 'Acme Ltd' })),
  };
  const impersonationToken: any = {
    create: jest.fn(async ({ data }: any) => {
      record = {
        id: 'tok_1',
        revokedAt: null,
        usedAt: null,
        createdAt: new Date(),
        ...data,
      };
      return record;
    }),
    update: jest.fn(async ({ where, data }: any) => {
      record = { ...(record ?? { id: where.id }), ...data, id: where.id };
      return record;
    }),
    findUnique: jest.fn(async (): Promise<any> => record),
    findMany: jest.fn(async (): Promise<any[]> => []),
    count: jest.fn(async (): Promise<number> => 0),
  };
  const db: any = { organization, impersonationToken };
  const auditService = { write: jest.fn(async () => ({})) };

  const service = new ImpersonationService(
    { db } as unknown as PrismaService,
    auditService as unknown as AdminAuditService,
  );
  return { service, organization, impersonationToken, auditService };
}

const adminUser = { id: 'adm_1', name: 'Admin One' } as any;

describe('ImpersonationService', () => {
  beforeAll(() => {
    process.env.ADMIN_IMPERSONATION_SECRET = SECRET;
  });

  describe('generateToken', () => {
    it('throws NotFound when the target organisation does not exist', async () => {
      const { service, organization } = build();
      organization.findUnique.mockResolvedValueOnce(null);

      await expect(service.generateToken('missing', 'support', adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates a DB record, signs a read-only 15-minute JWT, and audits it', async () => {
      const { service, impersonationToken, auditService } = build();

      const { signedJwt, tokenRecord } = await service.generateToken(ORG, 'support', adminUser, '1.2.3.4');

      expect(impersonationToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ adminId: 'adm_1', targetOrgId: ORG, reason: 'support' }),
        }),
      );
      // The signed token is persisted for revocation checks.
      expect(impersonationToken.update).toHaveBeenCalledWith({
        where: { id: 'tok_1' },
        data: { token: signedJwt },
      });

      const decoded = jwt.verify(signedJwt, SECRET) as any;
      expect(decoded.sub).toBe('tok_1');
      expect(decoded.readOnly).toBe(true);
      expect(decoded.targetOrgId).toBe(ORG);
      expect(decoded.exp - decoded.iat).toBe(15 * 60);

      expect(auditService.write).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: 'adm_1',
          actionType: 'IMPERSONATION_TOKEN_GENERATED',
          targetType: 'ORGANIZATION',
          targetId: ORG,
          reason: 'support',
          ipAddress: '1.2.3.4',
        }),
      );
      expect(tokenRecord.id).toBe('tok_1');
    });
  });

  describe('validateToken', () => {
    const sign = (sub = 'tok_1', expiresIn = '15m' as const) =>
      jwt.sign({ sub, adminId: 'adm_1', readOnly: true }, SECRET, { expiresIn });

    it('rejects a token that fails signature verification', async () => {
      const { service } = build();

      await expect(service.validateToken('not-a-jwt')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a token with no matching DB record', async () => {
      const { service, impersonationToken } = build();
      impersonationToken.findUnique.mockResolvedValueOnce(null);

      await expect(service.validateToken(sign())).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a revoked token', async () => {
      const { service, impersonationToken } = build();
      impersonationToken.findUnique.mockResolvedValueOnce({
        id: 'tok_1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
      });

      await expect(service.validateToken(sign())).rejects.toThrow(ForbiddenException);
    });

    it('rejects an expired DB record', async () => {
      const { service, impersonationToken } = build();
      impersonationToken.findUnique.mockResolvedValueOnce({
        id: 'tok_1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 60_000),
        usedAt: null,
      });

      await expect(service.validateToken(sign())).rejects.toThrow(ForbiddenException);
    });

    it('accepts a valid token and marks it used on first use only', async () => {
      const { service, impersonationToken } = build();
      impersonationToken.findUnique.mockResolvedValueOnce({
        id: 'tok_1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
      });

      const payload = await service.validateToken(sign());

      expect(payload.readOnly).toBe(true);
      expect(impersonationToken.update).toHaveBeenCalledWith({
        where: { id: 'tok_1' },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('does not rewrite usedAt when the token was already used', async () => {
      const { service, impersonationToken } = build();
      impersonationToken.findUnique.mockResolvedValueOnce({
        id: 'tok_1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: new Date(),
      });

      await service.validateToken(sign());

      expect(impersonationToken.update).not.toHaveBeenCalled();
    });
  });

  describe('revokeToken', () => {
    it('throws NotFound for an unknown token', async () => {
      const { service, impersonationToken } = build();
      impersonationToken.findUnique.mockResolvedValueOnce(null);

      await expect(service.revokeToken('nope', adminUser)).rejects.toThrow(NotFoundException);
    });

    it('throws Forbidden when already revoked', async () => {
      const { service, impersonationToken } = build();
      impersonationToken.findUnique.mockResolvedValueOnce({ id: 'tok_1', revokedAt: new Date() });

      await expect(service.revokeToken('tok_1', adminUser)).rejects.toThrow(ForbiddenException);
    });

    it('revokes and audits with the original reason preserved', async () => {
      const { service, impersonationToken, auditService } = build();
      impersonationToken.findUnique.mockResolvedValueOnce({
        id: 'tok_1',
        revokedAt: null,
        targetOrgId: ORG,
        targetOrgName: 'Acme Ltd',
        reason: 'support',
        adminId: 'adm_1',
        adminName: 'Admin One',
      });

      await service.revokeToken('tok_1', adminUser);

      expect(impersonationToken.update).toHaveBeenCalledWith({
        where: { id: 'tok_1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(auditService.write).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'IMPERSONATION_TOKEN_REVOKED',
          targetId: ORG,
          metadata: expect.objectContaining({ tokenId: 'tok_1', originalReason: 'support' }),
        }),
      );
    });
  });

  describe('listing', () => {
    it('paginates history at 50 per page with optional filters', async () => {
      const { service, impersonationToken } = build();
      impersonationToken.findMany.mockResolvedValue([{ id: 'tok_1' }]);
      impersonationToken.count.mockResolvedValue(1);

      const result = await service.listHistory({ adminId: 'adm_1', targetOrgId: ORG, page: 3 });

      expect(impersonationToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { adminId: 'adm_1', targetOrgId: ORG },
          take: 50,
          skip: 100,
        }),
      );
      expect(result).toEqual({ data: [{ id: 'tok_1' }], total: 1 });
    });

    it('lists only unrevoked, unexpired sessions as active', async () => {
      const { service, impersonationToken } = build();

      await service.listActive();

      expect(impersonationToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { revokedAt: null, expiresAt: { gt: expect.any(Date) } },
        }),
      );
    });
  });
});
