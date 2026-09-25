import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { RequireAdminRoles } from '../decorators/require-admin-roles.decorator';
import { AdminRole, CampaignStatus, BulkSendChannel } from '@prisma/client';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto, UpdateCampaignDto, SegmentCriteriaDto } from './dto/create-campaign.dto';

@Controller('admin/campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.MARKETING_ADMIN)
  async create(@Body() dto: CreateCampaignDto, @Req() req: any) {
    return this.campaignsService.create(
      dto,
      req.adminUser,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Get()
  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.MARKETING_ADMIN)
  async findAll(
    @Query('status') status: CampaignStatus | undefined,
    @Query('page') page: number | undefined,
    @Query('limit') limit: number | undefined,
  ) {
    return this.campaignsService.findAll(status, page, limit);
  }

  @Get(':id')
  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.MARKETING_ADMIN)
  async findOne(@Param('id') id: string) {
    return this.campaignsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.MARKETING_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
    @Req() req: any,
  ) {
    return this.campaignsService.update(
      id,
      dto,
      req.adminUser,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post(':id/cancel')
  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.MARKETING_ADMIN)
  async cancel(@Param('id') id: string, @Req() req: any) {
    return this.campaignsService.cancel(
      id,
      req.adminUser,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post(':id/execute')
  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.MARKETING_ADMIN)
  async executeNow(@Param('id') id: string, @Req() req: any) {
    return this.campaignsService.executeNow(
      id,
      req.adminUser,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post('estimate-reach')
  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.MARKETING_ADMIN)
  async estimateReach(
    @Body() body: { criteria: SegmentCriteriaDto; channel: BulkSendChannel },
  ) {
    return this.campaignsService.estimateReach(body.criteria, body.channel);
  }

  // Webhook endpoint (unauthenticated, called by Resend)
  @Post('webhooks/resend')
  async handleResendWebhook(@Body() payload: any) {
    return this.campaignsService.handleResendWebhook(payload);
  }
}
