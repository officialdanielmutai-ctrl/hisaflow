import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AdminAuditService } from '../audit/admin-audit.service';
import { CommsService } from '../comms/comms.service';
import { CreateCampaignDto, UpdateCampaignDto, SegmentCriteriaDto } from './dto/create-campaign.dto';
import { AdminUser, CampaignStatus, BulkSendChannel } from '@prisma/client';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AdminAuditService,
    private readonly commsService: CommsService,
  ) {}

  async create(
    dto: CreateCampaignDto,
    adminUser: AdminUser,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const isScheduled = !!dto.scheduledAt && new Date(dto.scheduledAt) > new Date();

    const campaign = await this.prisma.db.marketingCampaign.create({
      data: {
        name: dto.name,
        channel: dto.channel,
        status: isScheduled ? CampaignStatus.SCHEDULED : CampaignStatus.DRAFT,
        subject: dto.subject,
        body: dto.body,
        templateName: dto.templateName,
        segmentCriteria: (dto.segmentCriteria as any) || {},
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        createdByAdminId: adminUser.id,
        createdByAdminName: adminUser.name,
      },
    });

    await this.auditService.write({
      adminId: adminUser.id,
      actionType: 'campaign.create',
      targetType: 'campaign',
      targetId: campaign.id,
      targetLabel: campaign.name,
      reason: `Created marketing campaign: ${campaign.name}`,
      metadata: {
        channel: campaign.channel,
        status: campaign.status,
        scheduledAt: campaign.scheduledAt,
      },
      ipAddress,
      userAgent,
    });

    return campaign;
  }

  async update(
    id: string,
    dto: UpdateCampaignDto,
    adminUser: AdminUser,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const campaign = await this.prisma.db.marketingCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);

    if (campaign.status === CampaignStatus.COMPLETED) {
      throw new BadRequestException('Cannot edit a completed campaign');
    }

    const data: any = {};
    if (dto.name) data.name = dto.name;
    if (dto.channel) data.channel = dto.channel;
    if (dto.subject !== undefined) data.subject = dto.subject;
    if (dto.body) data.body = dto.body;
    if (dto.templateName !== undefined) data.templateName = dto.templateName;
    if (dto.segmentCriteria) data.segmentCriteria = dto.segmentCriteria as any;
    if (dto.scheduledAt !== undefined) {
      data.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
      if (dto.scheduledAt && new Date(dto.scheduledAt) > new Date()) {
        data.status = CampaignStatus.SCHEDULED;
      }
    }

    const updated = await this.prisma.db.marketingCampaign.update({
      where: { id },
      data,
    });

    await this.auditService.write({
      adminId: adminUser.id,
      actionType: 'campaign.update',
      targetType: 'campaign',
      targetId: updated.id,
      targetLabel: updated.name,
      reason: `Updated marketing campaign: ${updated.name}`,
      metadata: { before: campaign, after: updated },
      ipAddress,
      userAgent,
    });

    return updated;
  }

  async findAll(status?: CampaignStatus, page = 0, limit = 20) {
    const take = Math.min(Number(limit), 100);
    const skip = Number(page) * take;

    const where: any = status ? { status } : {};

    const [campaigns, total] = await Promise.all([
      this.prisma.db.marketingCampaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.db.marketingCampaign.count({ where }),
    ]);

    return { campaigns, total, page: Number(page), limit: take };
  }

  async findOne(id: string) {
    const campaign = await this.prisma.db.marketingCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);
    return campaign;
  }

  async cancel(
    id: string,
    adminUser: AdminUser,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const campaign = await this.prisma.db.marketingCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);

    if (campaign.status === CampaignStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel an already completed campaign');
    }

    const updated = await this.prisma.db.marketingCampaign.update({
      where: { id },
      data: { status: CampaignStatus.CANCELLED },
    });

    await this.auditService.write({
      adminId: adminUser.id,
      actionType: 'campaign.cancel',
      targetType: 'campaign',
      targetId: updated.id,
      targetLabel: updated.name,
      reason: `Cancelled campaign ${updated.name}`,
      metadata: { previousStatus: campaign.status },
      ipAddress,
      userAgent,
    });

    return updated;
  }

  async executeNow(
    id: string,
    adminUser: AdminUser,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const campaign = await this.prisma.db.marketingCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);

    if (campaign.status === CampaignStatus.COMPLETED) {
      throw new BadRequestException('Campaign has already been executed');
    }

    // Set to RUNNING
    await this.prisma.db.marketingCampaign.update({
      where: { id },
      data: { status: CampaignStatus.RUNNING },
    });

    const criteria = (campaign.segmentCriteria as any) || {};

    try {
      const dispatchResult = await this.commsService.dispatch(
        {
          channel: campaign.channel === BulkSendChannel.EMAIL ? ('EMAIL' as any) : ('SMS' as any),
          subject: campaign.subject || undefined,
          body: campaign.body,
          businessTypes: criteria.businessTypes,
          orgSearch: criteria.orgSearch,
        },
        adminUser,
        ipAddress,
        userAgent,
      );

      const completed = await this.prisma.db.marketingCampaign.update({
        where: { id },
        data: {
          status: CampaignStatus.COMPLETED,
          executedAt: new Date(),
          recipientCount: dispatchResult.recipientCount,
          deliveredCount: dispatchResult.successCount,
          failedCount: dispatchResult.failureCount,
        },
      });

      await this.auditService.write({
        adminId: adminUser.id,
        actionType: 'campaign.execute',
        targetType: 'campaign',
        targetId: campaign.id,
        targetLabel: campaign.name,
        reason: `Executed marketing campaign ${campaign.name} (${dispatchResult.successCount} delivered, ${dispatchResult.failureCount} failed)`,
        metadata: { dispatchResult },
        ipAddress,
        userAgent,
      });

      return completed;
    } catch (err: any) {
      this.logger.error(`Execution failed for campaign ${id}: ${err?.message}`);
      await this.prisma.db.marketingCampaign.update({
        where: { id },
        data: { status: CampaignStatus.DRAFT },
      });
      throw err;
    }
  }

  async estimateReach(criteria: SegmentCriteriaDto, channel: BulkSendChannel) {
    return this.commsService.preview({
      channel: channel === BulkSendChannel.EMAIL ? ('EMAIL' as any) : ('SMS' as any),
      body: 'Dummy reach check',
      businessTypes: criteria.businessTypes,
      orgSearch: criteria.orgSearch,
    });
  }

  async handleResendWebhook(payload: any) {
    const eventType = payload?.type;
    const email = payload?.data?.to?.[0];

    this.logger.log(`Resend webhook received: ${eventType} for ${email}`);

    // Track opens and clicks
    if (eventType === 'email.opened') {
      const activeCampaigns = await this.prisma.db.marketingCampaign.findMany({
        where: { status: CampaignStatus.COMPLETED },
        orderBy: { executedAt: 'desc' },
        take: 1,
      });
      if (activeCampaigns.length > 0) {
        await this.prisma.db.marketingCampaign.update({
          where: { id: activeCampaigns[0].id },
          data: { openedCount: { increment: 1 } },
        });
      }
    } else if (eventType === 'email.clicked') {
      const activeCampaigns = await this.prisma.db.marketingCampaign.findMany({
        where: { status: CampaignStatus.COMPLETED },
        orderBy: { executedAt: 'desc' },
        take: 1,
      });
      if (activeCampaigns.length > 0) {
        await this.prisma.db.marketingCampaign.update({
          where: { id: activeCampaigns[0].id },
          data: { clickedCount: { increment: 1 } },
        });
      }
    }

    return { received: true };
  }
}
