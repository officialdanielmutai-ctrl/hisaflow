import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AdminAuditService } from '../audit/admin-audit.service';
import { BulkSendPreviewDto, BulkChannel } from './dto/bulk-send.dto';
import { AdminUser, BulkSendStatus, DeliveryStatus, CommunicationOptOutStatus } from '@prisma/client';

export interface BulkPreviewResult {
  channel: 'EMAIL' | 'SMS';
  recipientCount: number;
  excludedCount: number;
  totalAudience: number;
  sampleRecipients: Array<{ name: string; email?: string; phone?: string; org?: string }>;
  filterSummary: string;
  estimatedCost?: string;
}

export interface BulkSendResult {
  id: string;
  recipientCount: number;
  successCount: number;
  failureCount: number;
  status: string;
  sentAt: string;
}

@Injectable()
export class CommsService {
  private readonly logger = new Logger(CommsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AdminAuditService,
  ) {}

  // ── Recipient resolution (consent-gated at DB level) ─────────────

  private async resolveEmailRecipients(dto: BulkSendPreviewDto) {
    if (dto.specificEmails?.length) {
      return dto.specificEmails.map((email) => ({ email, name: '', org: '' }));
    }

    const where: Record<string, any> = {
      emailStatus: CommunicationOptOutStatus.OPTED_IN, // hard DB-level gate
    };

    const consentRecords = await this.prisma.db.communicationConsent.findMany({
      where,
      select: { clerkUserId: true, email: true },
    });

    const clerkIds = consentRecords.map((c) => c.clerkUserId).filter(Boolean);
    const users = await this.prisma.db.user.findMany({
      where: {
        clerkId: { in: clerkIds },
        ...(dto.businessTypes?.length
          ? {
              memberships: {
                some: {
                  organization: { businessType: { in: dto.businessTypes } },
                },
              },
            }
          : {}),
      },
      include: {
        memberships: {
          take: 1,
          include: {
            organization: { select: { name: true, businessType: true } },
          },
        },
      },
    });

    const consentEmailMap = new Map(consentRecords.map((c) => [c.clerkUserId, c.email]));
    const search = dto.orgSearch?.toLowerCase();

    return users
      .filter((u) => {
        if (!search) return true;
        const orgName = u.memberships[0]?.organization?.name?.toLowerCase() || '';
        return orgName.includes(search) || (u.name?.toLowerCase() || '').includes(search);
      })
      .map((u) => ({
        name: u.name || '',
        email: consentEmailMap.get(u.clerkId) || u.email || '',
        org: u.memberships[0]?.organization?.name || '',
      }))
      .filter((r) => !!r.email);
  }

  private async resolveSmsRecipients(dto: BulkSendPreviewDto) {
    if (dto.specificPhones?.length) {
      return dto.specificPhones.map((phone) => ({ phone, name: '', org: '' }));
    }

    const consentRecords = await this.prisma.db.communicationConsent.findMany({
      where: { smsStatus: CommunicationOptOutStatus.OPTED_IN }, // hard DB-level gate
      select: { clerkUserId: true, phone: true },
    });

    const clerkIds = consentRecords.map((c) => c.clerkUserId).filter(Boolean);
    const users = await this.prisma.db.user.findMany({
      where: {
        clerkId: { in: clerkIds },
        ...(dto.businessTypes?.length
          ? {
              memberships: {
                some: {
                  organization: { businessType: { in: dto.businessTypes } },
                },
              },
            }
          : {}),
      },
      include: {
        memberships: {
          take: 1,
          include: {
            organization: { select: { name: true } },
          },
        },
      },
    });

    const consentPhoneMap = new Map(consentRecords.map((c) => [c.clerkUserId, c.phone]));
    const search = dto.orgSearch?.toLowerCase();

    return users
      .filter((u) => {
        if (!search) return true;
        const orgName = u.memberships[0]?.organization?.name?.toLowerCase() || '';
        return orgName.includes(search) || (u.name?.toLowerCase() || '').includes(search);
      })
      .map((u) => ({
        name: u.name || '',
        phone: consentPhoneMap.get(u.clerkId) || u.phone || '',
        org: u.memberships[0]?.organization?.name || '',
      }))
      .filter((r) => !!r.phone);
  }

  private async countExcludedRecipients(dto: BulkSendPreviewDto): Promise<number> {
    if (dto.channel === BulkChannel.EMAIL) {
      return this.prisma.db.communicationConsent.count({
        where: { emailStatus: CommunicationOptOutStatus.OPTED_OUT },
      });
    } else {
      return this.prisma.db.communicationConsent.count({
        where: { smsStatus: CommunicationOptOutStatus.OPTED_OUT },
      });
    }
  }

  private buildFilterSummary(dto: BulkSendPreviewDto): string {
    const parts: string[] = [];
    if (dto.specificEmails?.length) parts.push(`specific emails: ${dto.specificEmails.length}`);
    if (dto.specificPhones?.length) parts.push(`specific phones: ${dto.specificPhones.length}`);
    if (dto.businessTypes?.length) parts.push(`business types: ${dto.businessTypes.join(', ')}`);
    if (dto.orgSearch) parts.push(`org search: "${dto.orgSearch}"`);
    return parts.length ? parts.join(' · ') : 'all opted-in users';
  }

  // ── Preview ───────────────────────────────────────────────────────

  async preview(dto: BulkSendPreviewDto): Promise<BulkPreviewResult> {
    const [recipients, excludedCount] = await Promise.all([
      dto.channel === BulkChannel.EMAIL
        ? this.resolveEmailRecipients(dto)
        : this.resolveSmsRecipients(dto),
      this.countExcludedRecipients(dto),
    ]);

    const sample = recipients.slice(0, 5).map((r) => ({
      name: r.name,
      email: (r as any).email,
      phone: (r as any).phone,
      org: r.org,
    }));

    return {
      channel: dto.channel,
      recipientCount: recipients.length,
      excludedCount,
      totalAudience: recipients.length + excludedCount,
      sampleRecipients: sample,
      filterSummary: this.buildFilterSummary(dto),
      estimatedCost:
        dto.channel === BulkChannel.SMS
          ? `~${(recipients.length * 0.04).toFixed(2)} USD (Africa's Talking)`
          : undefined,
    };
  }

  // ── Dispatch ─────────────────────────────────────────────────────

  async dispatch(
    dto: BulkSendPreviewDto,
    adminUser: AdminUser,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<BulkSendResult> {
    if (dto.channel === BulkChannel.EMAIL && !dto.subject?.trim()) {
      throw new BadRequestException('Subject is required for email sends');
    }

    const recipients =
      dto.channel === BulkChannel.EMAIL
        ? await this.resolveEmailRecipients(dto)
        : await this.resolveSmsRecipients(dto);

    if (recipients.length === 0) {
      throw new BadRequestException('No opted-in recipients match the selected filters');
    }

    const filterSummary = this.buildFilterSummary(dto);

    // Create the log record in SENDING status
    const logRecord = await this.prisma.db.bulkSendLog.create({
      data: {
        adminId: adminUser.id,
        adminName: adminUser.name,
        channel: dto.channel,
        subject: dto.subject,
        body: dto.body,
        recipientCount: recipients.length,
        status: BulkSendStatus.SENDING,
        filterSummary,
      },
    });

    let successCount = 0;
    let failureCount = 0;

    try {
      if (dto.channel === BulkChannel.EMAIL) {
        const result = await this.sendEmailWithDeliveries(
          logRecord.id,
          dto,
          recipients as Array<{ name: string; email: string }>,
        );
        successCount = result.success;
        failureCount = result.failed;
      } else {
        const result = await this.sendSmsWithDeliveries(
          logRecord.id,
          dto,
          recipients as Array<{ name: string; phone: string }>,
        );
        successCount = result.success;
        failureCount = result.failed;
      }
    } catch (err: any) {
      this.logger.error(`Bulk send failed: ${err?.message}`);
      await this.prisma.db.bulkSendLog.update({
        where: { id: logRecord.id },
        data: { status: BulkSendStatus.FAILED },
      });
      throw new InternalServerErrorException(`Send failed: ${err?.message}`);
    }

    const finalStatus =
      failureCount === 0
        ? BulkSendStatus.SENT
        : successCount === 0
        ? BulkSendStatus.FAILED
        : BulkSendStatus.PARTIAL_FAILURE;

    const updated = await this.prisma.db.bulkSendLog.update({
      where: { id: logRecord.id },
      data: { status: finalStatus, successCount, failureCount, sentAt: new Date() },
    });

    await this.auditService.write({
      adminId: adminUser.id,
      actionType: 'comms.bulk_send',
      targetType: 'broadcast',
      targetId: logRecord.id,
      targetLabel: `${dto.channel} blast to ${recipients.length} recipients`,
      reason: filterSummary,
      metadata: {
        channel: dto.channel,
        subject: dto.subject,
        recipientCount: recipients.length,
        successCount,
        failureCount,
        status: finalStatus,
      },
      ipAddress,
      userAgent,
    });

    return {
      id: updated.id,
      recipientCount: updated.recipientCount,
      successCount: updated.successCount,
      failureCount: updated.failureCount,
      status: updated.status,
      sentAt: updated.sentAt?.toISOString() || new Date().toISOString(),
    };
  }

  // ── Email via Resend with CampaignDelivery tracking ──────────────

  private async sendEmailWithDeliveries(
    bulkSendLogId: string,
    dto: BulkSendPreviewDto,
    recipients: Array<{ name: string; email: string }>,
  ) {
    const apiKey = this.configService.get<string>('resend.apiKey') || process.env.RESEND_API_KEY;
    const fromAddress =
      this.configService.get<string>('resend.fromEmail') ||
      process.env.RESEND_FROM_EMAIL ||
      'noreply@hisaflow.com';

    let success = 0;
    let failed = 0;

    const resend = apiKey ? new Resend(apiKey) : null;
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not set — operating in simulation/mock delivery mode');
    }

    const BATCH = 50;
    for (let i = 0; i < recipients.length; i += BATCH) {
      const batch = recipients.slice(i, i + BATCH);
      await Promise.allSettled(
        batch.map(async (r) => {
          let deliveryStatus: DeliveryStatus = DeliveryStatus.DELIVERED;
          let errorMessage: string | undefined = undefined;

          if (resend) {
            try {
              await resend.emails.send({
                from: fromAddress,
                to: r.email,
                subject: dto.subject!,
                html: dto.body.replace(/\n/g, '<br>'),
              });
              success++;
            } catch (e: any) {
              this.logger.warn(`Failed to email ${r.email}: ${e?.message}`);
              deliveryStatus = DeliveryStatus.FAILED;
              errorMessage = e?.message || 'Send error';
              failed++;
            }
          } else {
            // Mock delivery
            success++;
          }

          // Persist delivery status per recipient
          await this.prisma.db.campaignDelivery.create({
            data: {
              bulkSendLogId,
              recipient: r.email,
              channel: 'EMAIL',
              status: deliveryStatus,
              errorMessage,
              deliveredAt: deliveryStatus === DeliveryStatus.DELIVERED ? new Date() : null,
            },
          });
        }),
      );

      if (i + BATCH < recipients.length) {
        await new Promise((res) => setTimeout(res, 200));
      }
    }

    return { success, failed };
  }

  // ── SMS via Africa's Talking with CampaignDelivery tracking ────────

  private async sendSmsWithDeliveries(
    bulkSendLogId: string,
    dto: BulkSendPreviewDto,
    recipients: Array<{ name: string; phone: string }>,
  ) {
    const apiKey =
      this.configService.get<string>('africasTalking.apiKey') || process.env.AFRICASTALKING_API_KEY;
    const username =
      this.configService.get<string>('africasTalking.username') ||
      process.env.AFRICASTALKING_USERNAME ||
      'sandbox';
    const senderId =
      this.configService.get<string>('africasTalking.senderId') ||
      process.env.AFRICASTALKING_SENDER_ID;

    const normalize = (phone: string) => {
      const digits = phone.replace(/\D/g, '');
      if (digits.startsWith('0')) return `+254${digits.slice(1)}`;
      if (digits.startsWith('254')) return `+${digits}`;
      return `+${digits}`;
    };

    let success = 0;
    let failed = 0;

    if (apiKey) {
      const phones = recipients.map((r) => normalize(r.phone));

      const body = new URLSearchParams();
      body.append('username', username);
      body.append('to', phones.join(','));
      body.append('message', dto.body);
      if (senderId) body.append('from', senderId);

      try {
        const response = await fetch('https://api.africastalking.com/version1/messaging', {
          method: 'POST',
          headers: {
            apiKey: apiKey,
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        });

        const data: any = await response.json();
        const entries: any[] = data?.SMSMessageData?.Recipients || [];
        const entryMap = new Map(entries.map((e) => [e.number, e]));

        for (const r of recipients) {
          const norm = normalize(r.phone);
          const entry = entryMap.get(norm);
          const isDelivered = entry ? entry.statusCode === 101 : true;
          if (isDelivered) success++;
          else failed++;

          await this.prisma.db.campaignDelivery.create({
            data: {
              bulkSendLogId,
              recipient: norm,
              channel: 'SMS',
              status: isDelivered ? DeliveryStatus.DELIVERED : DeliveryStatus.FAILED,
              errorMessage: isDelivered ? null : (entry?.status || 'SMS delivery failed'),
              deliveredAt: isDelivered ? new Date() : null,
            },
          });
        }
      } catch (err: any) {
        this.logger.error(`Africa's Talking error: ${err?.message}`);
        failed = recipients.length;
        for (const r of recipients) {
          await this.prisma.db.campaignDelivery.create({
            data: {
              bulkSendLogId,
              recipient: normalize(r.phone),
              channel: 'SMS',
              status: DeliveryStatus.FAILED,
              errorMessage: err?.message,
            },
          });
        }
      }
    } else {
      this.logger.warn('AFRICASTALKING_API_KEY not configured — mock delivery mode');
      success = recipients.length;
      for (const r of recipients) {
        await this.prisma.db.campaignDelivery.create({
          data: {
            bulkSendLogId,
            recipient: normalize(r.phone),
            channel: 'SMS',
            status: DeliveryStatus.DELIVERED,
            deliveredAt: new Date(),
          },
        });
      }
    }

    return { success, failed };
  }

  // ── History with per-batch delivery stats ─────────────────────────

  async getHistory(page = 0, limit = 20) {
    const take = Math.min(Number(limit), 100);
    const skip = Number(page) * take;

    const [logs, total] = await Promise.all([
      this.prisma.db.bulkSendLog.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: {
          _count: {
            select: { deliveries: true },
          },
        },
      }),
      this.prisma.db.bulkSendLog.count(),
    ]);

    return { logs, total, page: Number(page), limit: take };
  }
}
