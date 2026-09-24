import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AdminAuditService } from '../audit/admin-audit.service';
import { QueryAccountsDto } from './dto/query-accounts.dto';
import { AdminUser } from '@prisma/client';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AdminAuditService,
  ) {}

  private getClerkClient() {
    const secretKey =
      this.configService.get<string>('clerk.secretKey') || process.env.CLERK_SECRET_KEY;
    return createClerkClient({ secretKey });
  }

  async listAccounts(query: QueryAccountsDto) {
    const where: any = {};

    if (query.businessType && query.businessType !== 'all') {
      where.businessType = query.businessType;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
        {
          users: {
            some: {
              user: {
                OR: [
                  { email: { contains: query.search, mode: 'insensitive' } },
                  { name: { contains: query.search, mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      ];
    }

    const take = Math.min(Number(query.limit) || 20, 100);
    const skip = Number(query.offset) || 0;

    const [items, total] = await Promise.all([
      this.prisma.db.organization.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              users: true,
              products: true,
              subscribers: true,
              alerts: { where: { status: 'UNRESOLVED' } },
            },
          },
        },
      }),
      this.prisma.db.organization.count({ where }),
    ]);

    // Check freeze status from recent audit log actions for each org
    const orgIds = items.map((i) => i.id);
    const recentAuditLogs = await this.prisma.db.adminAuditLog.findMany({
      where: {
        targetType: 'organization',
        targetId: { in: orgIds },
        actionType: { in: ['account.freeze', 'account.unfreeze'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    const statusMap = new Map<string, 'FROZEN' | 'ACTIVE'>();
    for (const log of recentAuditLogs) {
      if (!statusMap.has(log.targetId!)) {
        statusMap.set(log.targetId!, log.actionType === 'account.freeze' ? 'FROZEN' : 'ACTIVE');
      }
    }

    const enrichedItems = items.map((org) => ({
      ...org,
      status: statusMap.get(org.id) || 'ACTIVE',
    }));

    // If status filter was specified
    let filteredItems = enrichedItems;
    if (query.status && query.status !== 'all') {
      const targetStatus = query.status.toUpperCase();
      filteredItems = enrichedItems.filter((i) => i.status === targetStatus);
    }

    return {
      items: filteredItems,
      total,
      limit: take,
      offset: skip,
    };
  }

  async getAccount(orgId: string) {
    const org = await this.prisma.db.organization.findUnique({
      where: { id: orgId },
      include: {
        users: {
          include: {
            user: true,
          },
        },
        _count: {
          select: {
            products: true,
            transactions: true,
            subscribers: true,
            routers: true,
            alerts: { where: { status: 'UNRESOLVED' } },
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException(`Organization with ID ${orgId} not found`);
    }

    // Determine current freeze state from latest audit log
    const latestAction = await this.prisma.db.adminAuditLog.findFirst({
      where: {
        targetType: 'organization',
        targetId: orgId,
        actionType: { in: ['account.freeze', 'account.unfreeze'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    const isFrozen = latestAction?.actionType === 'account.freeze';

    // Fetch live Clerk status for each user
    const clerk = this.getClerkClient();
    const enrichedUsers = await Promise.all(
      org.users.map(async (membership) => {
        let clerkStatus = {
          banned: false,
          lastActiveAt: null as Date | null,
          imageUrl: null as string | null,
          verifiedEmail: membership.user.email,
        };

        if (membership.user.clerkId) {
          try {
            const clerkUser = await clerk.users.getUser(membership.user.clerkId);
            clerkStatus = {
              banned: Boolean(clerkUser.banned),
              lastActiveAt: clerkUser.lastActiveAt ? new Date(clerkUser.lastActiveAt) : null,
              imageUrl: clerkUser.imageUrl || null,
              verifiedEmail: clerkUser.emailAddresses[0]?.emailAddress || membership.user.email,
            };
          } catch (err: any) {
            this.logger.warn(`Could not fetch Clerk user ${membership.user.clerkId}: ${err?.message}`);
          }
        }

        return {
          id: membership.id,
          role: membership.role,
          user: {
            id: membership.user.id,
            clerkId: membership.user.clerkId,
            name: membership.user.name,
            email: clerkStatus.verifiedEmail,
            phone: membership.user.phone,
            banned: clerkStatus.banned,
            imageUrl: clerkStatus.imageUrl,
            lastActiveAt: clerkStatus.lastActiveAt,
          },
        };
      }),
    );

    return {
      organization: {
        id: org.id,
        name: org.name,
        businessType: org.businessType,
        currency: org.currency,
        country: org.country,
        phone: org.phone,
        inviteCode: org.inviteCode,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
        status: isFrozen ? 'FROZEN' : 'ACTIVE',
        counts: org._count,
      },
      users: enrichedUsers,
      latestAction,
    };
  }

  async freezeAccount(
    orgId: string,
    reason: string,
    adminUser: AdminUser,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const org = await this.prisma.db.organization.findUnique({
      where: { id: orgId },
      include: {
        users: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException(`Organization with ID ${orgId} not found`);
    }

    const clerk = this.getClerkClient();
    const bannedClerkIds: string[] = [];
    const errors: string[] = [];

    // Ban all users in the organization via Clerk Backend API
    for (const membership of org.users) {
      const clerkId = membership.user.clerkId;
      if (clerkId) {
        try {
          await clerk.users.banUser(clerkId);
          bannedClerkIds.push(clerkId);
        } catch (err: any) {
          this.logger.error(`Error banning Clerk user ${clerkId}: ${err?.message}`);
          errors.push(`${clerkId}: ${err?.message}`);
        }
      }
    }

    // Synchronously write to AdminAuditLog
    await this.auditService.write({
      adminId: adminUser.id,
      actionType: 'account.freeze',
      targetType: 'organization',
      targetId: org.id,
      targetLabel: org.name,
      reason,
      metadata: {
        bannedCount: bannedClerkIds.length,
        bannedClerkIds,
        errors: errors.length > 0 ? errors : undefined,
      },
      ipAddress,
      userAgent,
    });

    return {
      success: true,
      message: `Organization "${org.name}" has been frozen and ${bannedClerkIds.length} user session(s) revoked.`,
      bannedCount: bannedClerkIds.length,
    };
  }

  async unfreezeAccount(
    orgId: string,
    reason: string,
    adminUser: AdminUser,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const org = await this.prisma.db.organization.findUnique({
      where: { id: orgId },
      include: {
        users: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException(`Organization with ID ${orgId} not found`);
    }

    const clerk = this.getClerkClient();
    const unbannedClerkIds: string[] = [];
    const errors: string[] = [];

    // Unban all users in the organization via Clerk Backend API
    for (const membership of org.users) {
      const clerkId = membership.user.clerkId;
      if (clerkId) {
        try {
          await clerk.users.unbanUser(clerkId);
          unbannedClerkIds.push(clerkId);
        } catch (err: any) {
          this.logger.error(`Error unbanning Clerk user ${clerkId}: ${err?.message}`);
          errors.push(`${clerkId}: ${err?.message}`);
        }
      }
    }

    // Synchronously write to AdminAuditLog
    await this.auditService.write({
      adminId: adminUser.id,
      actionType: 'account.unfreeze',
      targetType: 'organization',
      targetId: org.id,
      targetLabel: org.name,
      reason,
      metadata: {
        unbannedCount: unbannedClerkIds.length,
        unbannedClerkIds,
        errors: errors.length > 0 ? errors : undefined,
      },
      ipAddress,
      userAgent,
    });

    return {
      success: true,
      message: `Organization "${org.name}" has been unfrozen and ${unbannedClerkIds.length} user account(s) restored.`,
      unbannedCount: unbannedClerkIds.length,
    };
  }

  async getAccountHistory(orgId: string) {
    return this.prisma.db.adminAuditLog.findMany({
      where: {
        targetType: 'organization',
        targetId: orgId,
      },
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
    });
  }
}
