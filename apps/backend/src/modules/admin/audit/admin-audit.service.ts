import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AdminAuditLog } from '@prisma/client';
import * as crypto from 'crypto';

export interface WriteAuditLogDto {
  adminId: string;
  actionType: string;
  targetType: string;
  targetId?: string;
  targetLabel?: string;
  reason?: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}

export interface QueryAuditLogsDto {
  adminId?: string;
  actionType?: string;
  targetType?: string;
  targetId?: string;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Synchronously records an immutable administrative action to AdminAuditLog.
   * Invariant: Must be called before returning success on any state-changing admin action.
   */
  async write(dto: WriteAuditLogDto): Promise<AdminAuditLog> {
    try {
      const log = await this.prisma.db.adminAuditLog.create({
        data: {
          adminId: dto.adminId,
          actionType: dto.actionType,
          targetType: dto.targetType,
          targetId: dto.targetId || null,
          targetLabel: dto.targetLabel || null,
          reason: dto.reason || null,
          metadata: dto.metadata || undefined,
          ipAddress: dto.ipAddress || null,
          userAgent: dto.userAgent || null,
        },
      });

      this.logger.log(
        `AUDIT: [${dto.actionType}] by admin ${dto.adminId} on ${dto.targetType}:${dto.targetId || 'global'}${
          dto.reason ? ` — Reason: "${dto.reason}"` : ''
        }`,
      );

      return log;
    } catch (err: any) {
      this.logger.error(`Failed to write to AdminAuditLog: ${err?.message}`, err?.stack);
      throw err;
    }
  }

  /**
   * Queries audit logs with pagination and multi-dimensional filters.
   */
  async findLogs(query: QueryAuditLogsDto) {
    const where: any = {};

    if (query.adminId) where.adminId = query.adminId;
    if (query.actionType) where.actionType = query.actionType;
    if (query.targetType) where.targetType = query.targetType;
    if (query.targetId) where.targetId = query.targetId;

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    if (query.search?.trim()) {
      where.OR = [
        { actionType: { contains: query.search.trim(), mode: 'insensitive' } },
        { targetLabel: { contains: query.search.trim(), mode: 'insensitive' } },
        { reason: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }

    const take = Math.min(Number(query.limit) || 50, 100);
    const skip = Number(query.offset) || 0;

    const [items, total] = await Promise.all([
      this.prisma.db.adminAuditLog.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.db.adminAuditLog.count({ where }),
    ]);

    return {
      items,
      total,
      limit: take,
      offset: skip,
    };
  }

  /**
   * Returns metadata for filter dropdowns: distinct action types, target types, and active admins.
   */
  async getAuditMeta() {
    const [actionTypesResult, targetTypesResult, admins] = await Promise.all([
      this.prisma.db.adminAuditLog.findMany({
        select: { actionType: true },
        distinct: ['actionType'],
      }),
      this.prisma.db.adminAuditLog.findMany({
        select: { targetType: true },
        distinct: ['targetType'],
      }),
      this.prisma.db.adminUser.findMany({
        select: { id: true, name: true, email: true },
        where: { isActive: true },
      }),
    ]);

    return {
      actionTypes: actionTypesResult.map((a) => a.actionType),
      targetTypes: targetTypesResult.map((t) => t.targetType),
      admins,
    };
  }

  /**
   * Exports CSV with calculated SHA-256 integrity hash.
   */
  async exportCsvWithChecksum(query: QueryAuditLogsDto) {
    const logs = await this.findLogs({ ...query, limit: 5000, offset: 0 });

    const headers = [
      'Timestamp',
      'Admin Name',
      'Admin Email',
      'Action Type',
      'Target Type',
      'Target ID',
      'Target Label',
      'Reason',
      'IP Address',
    ];

    const rows = logs.items.map((log: any) => [
      log.createdAt.toISOString(),
      `"${(log.admin?.name || 'System').replace(/"/g, '""')}"`,
      log.admin?.email || '',
      log.actionType,
      log.targetType,
      log.targetId || '',
      `"${(log.targetLabel || '').replace(/"/g, '""')}"`,
      `"${(log.reason || '').replace(/"/g, '""')}"`,
      log.ipAddress || '',
    ]);

    const csvBody = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const sha256 = crypto.createHash('sha256').update(csvBody, 'utf8').digest('hex');

    const csvWithChecksum = `${csvBody}\n\n# Integrity Checksum (SHA-256): ${sha256}\n`;

    return {
      csvContent: csvWithChecksum,
      sha256,
      count: logs.items.length,
    };
  }
}
