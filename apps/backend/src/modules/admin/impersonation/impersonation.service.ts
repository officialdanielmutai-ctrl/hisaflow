import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AdminUser, ImpersonationToken } from '@prisma/client';
import { AdminAuditService } from '../audit/admin-audit.service';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

export interface ImpersonationPayload {
  sub: string; // token DB id
  adminId: string;
  adminName: string;
  targetOrgId: string;
  targetOrgName: string;
  reason: string;
  readOnly: true;
  iat: number;
  exp: number;
}

@Injectable()
export class ImpersonationService {
  private readonly logger = new Logger(ImpersonationService.name);
  private readonly JWT_SECRET: string;
  private readonly TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AdminAuditService,
  ) {
    this.JWT_SECRET =
      process.env.ADMIN_IMPERSONATION_SECRET ||
      process.env.CLERK_SECRET_KEY ||
      'impersonation-fallback-secret';
  }

  // ── Generate Token ────────────────────────────────────────────────

  async generateToken(
    targetOrgId: string,
    reason: string,
    adminUser: AdminUser,
    ipAddress?: string,
  ): Promise<{ tokenRecord: ImpersonationToken; signedJwt: string }> {
    // Verify the org exists
    const org = await this.prisma.db.organization.findUnique({
      where: { id: targetOrgId },
      select: { id: true, name: true },
    });
    if (!org) {
      throw new NotFoundException(`Organization ${targetOrgId} not found`);
    }

    // Create a temporary DB record first to get its ID (used as JWT sub)
    const placeholder = await this.prisma.db.impersonationToken.create({
      data: {
        adminId: adminUser.id,
        adminName: adminUser.name,
        targetOrgId: org.id,
        targetOrgName: org.name,
        reason,
        token: crypto.randomBytes(32).toString('hex'), // temp — will overwrite
        expiresAt: new Date(Date.now() + this.TOKEN_TTL_SECONDS * 1000),
      },
    });

    // Sign the JWT
    const payload: Omit<ImpersonationPayload, 'iat' | 'exp'> = {
      sub: placeholder.id,
      adminId: adminUser.id,
      adminName: adminUser.name,
      targetOrgId: org.id,
      targetOrgName: org.name,
      reason,
      readOnly: true,
    };

    const signedJwt = jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.TOKEN_TTL_SECONDS,
    });

    // Persist the actual signed token for revocation checking
    const tokenRecord = await this.prisma.db.impersonationToken.update({
      where: { id: placeholder.id },
      data: { token: signedJwt },
    });

    // Audit log
    await this.auditService.write({
      adminId: adminUser.id,
      actionType: 'IMPERSONATION_TOKEN_GENERATED',
      targetType: 'ORGANIZATION',
      targetId: org.id,
      targetLabel: org.name,
      reason,
      metadata: {
        tokenId: tokenRecord.id,
        expiresAt: tokenRecord.expiresAt.toISOString(),
        adminName: adminUser.name,
      },
      ipAddress,
    });

    this.logger.warn(
      `VIEW-AS: Admin [${adminUser.name}] generated read-only token for org [${org.name}] — Reason: "${reason}"`,
    );

    return { tokenRecord, signedJwt };
  }

  // ── Validate Token ────────────────────────────────────────────────

  async validateToken(signedJwt: string): Promise<ImpersonationPayload> {
    let decoded: ImpersonationPayload;
    try {
      decoded = jwt.verify(signedJwt, this.JWT_SECRET) as ImpersonationPayload;
    } catch {
      throw new UnauthorizedException('Impersonation token is invalid or expired');
    }

    // Check DB record for revocation
    const record = await this.prisma.db.impersonationToken.findUnique({
      where: { id: decoded.sub },
    });
    if (!record) {
      throw new UnauthorizedException('Impersonation token not found');
    }
    if (record.revokedAt) {
      throw new ForbiddenException('Impersonation token has been revoked');
    }
    if (record.expiresAt < new Date()) {
      throw new ForbiddenException('Impersonation token has expired');
    }

    // Mark used (non-blocking — only first use)
    if (!record.usedAt) {
      await this.prisma.db.impersonationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
    }

    return decoded;
  }

  // ── Revoke Token ──────────────────────────────────────────────────

  async revokeToken(tokenId: string, adminUser: AdminUser): Promise<ImpersonationToken> {
    const record = await this.prisma.db.impersonationToken.findUnique({
      where: { id: tokenId },
    });
    if (!record) {
      throw new NotFoundException(`Impersonation token ${tokenId} not found`);
    }
    if (record.revokedAt) {
      throw new ForbiddenException('Token is already revoked');
    }

    const revoked = await this.prisma.db.impersonationToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });

    await this.auditService.write({
      adminId: adminUser.id,
      actionType: 'IMPERSONATION_TOKEN_REVOKED',
      targetType: 'ORGANIZATION',
      targetId: record.targetOrgId,
      targetLabel: record.targetOrgName,
      reason: `Revoked by ${adminUser.name}`,
      metadata: {
        tokenId,
        originalReason: record.reason,
        originalAdminId: record.adminId,
        originalAdminName: record.adminName,
      },
    });

    this.logger.warn(
      `VIEW-AS REVOKED: Admin [${adminUser.name}] revoked token [${tokenId}] for org [${record.targetOrgName}]`,
    );

    return revoked;
  }

  // ── List History ──────────────────────────────────────────────────

  async listHistory(
    opts: { adminId?: string; targetOrgId?: string; page?: number } = {},
  ): Promise<{ data: ImpersonationToken[]; total: number }> {
    const limit = 50;
    const offset = ((opts.page ?? 1) - 1) * limit;

    const where: any = {};
    if (opts.adminId) where.adminId = opts.adminId;
    if (opts.targetOrgId) where.targetOrgId = opts.targetOrgId;

    const [data, total] = await Promise.all([
      this.prisma.db.impersonationToken.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.db.impersonationToken.count({ where }),
    ]);

    return { data, total };
  }

  // ── List Active Sessions ──────────────────────────────────────────

  async listActive(): Promise<ImpersonationToken[]> {
    return this.prisma.db.impersonationToken.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
