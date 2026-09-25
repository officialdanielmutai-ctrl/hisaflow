import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AdminAuditService } from '../audit/admin-audit.service';
import { CommunicationOptOutStatus, AdminUser } from '@prisma/client';

export interface DirectoryUser {
  clerkId: string;
  name: string;
  email?: string;
  phone?: string;
  imageUrl?: string;
  banned: boolean;
  lastActiveAt?: string;
  createdAt: string;
  emailStatus: 'OPTED_IN' | 'OPTED_OUT';
  smsStatus: 'OPTED_IN' | 'OPTED_OUT';
  primaryOrg?: {
    id: string;
    name: string;
    businessType: string;
    role: string;
  };
}

@Injectable()
export class DirectoryService {
  private readonly logger = new Logger(DirectoryService.name);

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

  async listUsers(search?: string, limit: number = 20, offset: number = 0) {
    const clerk = this.getClerkClient();
    const take = Math.min(Number(limit), 100);
    const skip = Number(offset);

    try {
      const params: Record<string, any> = { limit: take, offset: skip };
      if (search?.trim()) params.query = search.trim();

      const clerkUsers = await clerk.users.getUserList(params);
      const users = clerkUsers.data;
      const totalCount = clerkUsers.totalCount;

      // Bulk-load consent records
      const clerkIds = users.map((u) => u.id);
      const consentRecords = await this.prisma.db.communicationConsent.findMany({
        where: { clerkUserId: { in: clerkIds } },
      });
      const consentMap = new Map(consentRecords.map((c) => [c.clerkUserId, c]));

      // Bulk-load local users + memberships
      const localUsers = await this.prisma.db.user.findMany({
        where: { clerkId: { in: clerkIds } },
        include: {
          memberships: {
            take: 1,
            include: {
              organization: {
                select: { id: true, name: true, businessType: true },
              },
            },
          },
        },
      });
      const localUserMap = new Map(localUsers.map((u) => [u.clerkId, u]));

      const enriched: DirectoryUser[] = users.map((cu) => {
        const consent = consentMap.get(cu.id);
        const local = localUserMap.get(cu.id);
        const primaryMembership = local?.memberships?.[0];

        return {
          clerkId: cu.id,
          name: `${cu.firstName || ''} ${cu.lastName || ''}`.trim() || 'Unknown',
          email: cu.emailAddresses?.[0]?.emailAddress,
          phone: cu.phoneNumbers?.[0]?.phoneNumber,
          imageUrl: cu.imageUrl || undefined,
          banned: Boolean(cu.banned),
          lastActiveAt: cu.lastActiveAt ? new Date(cu.lastActiveAt).toISOString() : undefined,
          createdAt: new Date(cu.createdAt).toISOString(),
          emailStatus: consent?.emailStatus === CommunicationOptOutStatus.OPTED_OUT ? 'OPTED_OUT' : 'OPTED_IN',
          smsStatus: consent?.smsStatus === CommunicationOptOutStatus.OPTED_OUT ? 'OPTED_OUT' : 'OPTED_IN',
          primaryOrg: primaryMembership
            ? {
                id: primaryMembership.organization.id,
                name: primaryMembership.organization.name,
                businessType: primaryMembership.organization.businessType,
                role: primaryMembership.role,
              }
            : undefined,
        };
      });

      return { users: enriched, total: totalCount, limit: take, offset: skip };
    } catch (err: any) {
      this.logger.error(`Clerk getUserList failed (${err?.message}) — falling back to local DB`);
      return this.listUsersFromLocalDb(search, take, skip);
    }
  }

  private async listUsersFromLocalDb(search: string | undefined, take: number, skip: number) {
    const where: Record<string, any> = {};
    if (search?.trim()) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [localUsers, total] = await Promise.all([
      this.prisma.db.user.findMany({
        where,
        take,
        skip,
        include: {
          memberships: {
            take: 1,
            include: {
              organization: { select: { id: true, name: true, businessType: true } },
            },
          },
        },
      }),
      this.prisma.db.user.count({ where }),
    ]);

    const clerkIds = localUsers.map((u) => u.clerkId).filter(Boolean) as string[];
    const consentRecords = await this.prisma.db.communicationConsent.findMany({
      where: { clerkUserId: { in: clerkIds } },
    });
    const consentMap = new Map(consentRecords.map((c) => [c.clerkUserId, c]));

    const users: DirectoryUser[] = localUsers.map((u) => {
      const consent = u.clerkId ? consentMap.get(u.clerkId) : undefined;
      const primaryMembership = u.memberships?.[0];
      return {
        clerkId: u.clerkId || '',
        name: u.name || 'Unknown',
        email: u.email || undefined,
        phone: u.phone || undefined,
        banned: false,
        createdAt: u.createdAt.toISOString(),
        emailStatus: consent?.emailStatus === CommunicationOptOutStatus.OPTED_OUT ? 'OPTED_OUT' : 'OPTED_IN',
        smsStatus: consent?.smsStatus === CommunicationOptOutStatus.OPTED_OUT ? 'OPTED_OUT' : 'OPTED_IN',
        primaryOrg: primaryMembership
          ? {
              id: primaryMembership.organization.id,
              name: primaryMembership.organization.name,
              businessType: primaryMembership.organization.businessType,
              role: primaryMembership.role,
            }
          : undefined,
      };
    });

    return { users, total, limit: take, offset: skip };
  }

  async getUser(clerkId: string): Promise<DirectoryUser> {
    const clerk = this.getClerkClient();

    let clerkUser: any = null;
    try {
      clerkUser = await clerk.users.getUser(clerkId);
    } catch {
      this.logger.warn(`Clerk user ${clerkId} not found — falling back to local DB`);
    }

    const [localUser, consent] = await Promise.all([
      this.prisma.db.user.findFirst({
        where: { clerkId },
        include: {
          memberships: {
            include: {
              organization: { select: { id: true, name: true, businessType: true } },
            },
          },
        },
      }),
      this.prisma.db.communicationConsent.findUnique({
        where: { clerkUserId: clerkId },
      }),
    ]);

    if (!clerkUser && !localUser) {
      throw new NotFoundException(`User ${clerkId} not found`);
    }

    const primaryMembership = localUser?.memberships?.[0];

    return {
      clerkId,
      name: clerkUser
        ? `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim()
        : (localUser?.name || 'Unknown'),
      email: clerkUser?.emailAddresses?.[0]?.emailAddress || localUser?.email || undefined,
      phone: clerkUser?.phoneNumbers?.[0]?.phoneNumber || localUser?.phone || undefined,
      imageUrl: clerkUser?.imageUrl || undefined,
      banned: Boolean(clerkUser?.banned),
      lastActiveAt: clerkUser?.lastActiveAt ? new Date(clerkUser.lastActiveAt).toISOString() : undefined,
      createdAt: clerkUser
        ? new Date(clerkUser.createdAt).toISOString()
        : (localUser?.createdAt.toISOString() || new Date().toISOString()),
      emailStatus: consent?.emailStatus === CommunicationOptOutStatus.OPTED_OUT ? 'OPTED_OUT' : 'OPTED_IN',
      smsStatus: consent?.smsStatus === CommunicationOptOutStatus.OPTED_OUT ? 'OPTED_OUT' : 'OPTED_IN',
      primaryOrg: primaryMembership
        ? {
            id: primaryMembership.organization.id,
            name: primaryMembership.organization.name,
            businessType: primaryMembership.organization.businessType,
            role: primaryMembership.role,
          }
        : undefined,
    };
  }

  async updateConsent(
    clerkId: string,
    emailStatus: 'OPTED_IN' | 'OPTED_OUT' | undefined,
    smsStatus: 'OPTED_IN' | 'OPTED_OUT' | undefined,
    adminUser?: AdminUser,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const existing = await this.prisma.db.communicationConsent.findUnique({
      where: { clerkUserId: clerkId },
    });

    const updateData: Record<string, CommunicationOptOutStatus> = {};
    if (emailStatus) updateData.emailStatus = emailStatus as CommunicationOptOutStatus;
    if (smsStatus) updateData.smsStatus = smsStatus as CommunicationOptOutStatus;

    const updated = await this.prisma.db.communicationConsent.upsert({
      where: { clerkUserId: clerkId },
      create: {
        clerkUserId: clerkId,
        emailStatus: (emailStatus as CommunicationOptOutStatus) || CommunicationOptOutStatus.OPTED_IN,
        smsStatus: (smsStatus as CommunicationOptOutStatus) || CommunicationOptOutStatus.OPTED_IN,
      },
      update: updateData,
    });

    if (adminUser) {
      await this.auditService.write({
        adminId: adminUser.id,
        actionType: 'consent.update',
        targetType: 'user',
        targetId: clerkId,
        targetLabel: clerkId,
        reason: `Consent updated by admin ${adminUser.name}`,
        metadata: {
          before: existing
            ? { emailStatus: existing.emailStatus, smsStatus: existing.smsStatus }
            : null,
          after: { emailStatus: updated.emailStatus, smsStatus: updated.smsStatus },
        },
        ipAddress,
        userAgent,
      });
    }

    return updated;
  }

  async exportUsersCsv(search?: string): Promise<string> {
    const result = await this.listUsers(search, 5000, 0);
    const headers = ['Clerk ID', 'Name', 'Email', 'Phone', 'Org', 'Email Consent', 'SMS Consent', 'Last Active'];
    const rows = result.users.map((u) => [
      u.clerkId,
      u.name,
      u.email || '',
      u.phone || '',
      u.primaryOrg?.name || '',
      u.emailStatus,
      u.smsStatus,
      u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString() : '',
    ]);

    return [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }
}
