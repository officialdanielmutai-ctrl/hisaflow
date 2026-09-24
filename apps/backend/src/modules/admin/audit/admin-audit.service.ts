import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AdminAuditLog } from '@prisma/client';

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
   * Queries audit logs with pagination and filters.
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
}
