import { Controller, Post, Get, Body, Query, UseGuards, Req } from '@nestjs/common';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { RequireAdminRoles } from '../decorators/require-admin-roles.decorator';
import { AdminRole } from '@prisma/client';
import { CommsService } from './comms.service';
import { BulkSendPreviewDto, BulkSendDispatchDto } from './dto/bulk-send.dto';

@UseGuards(AdminAuthGuard, AdminRoleGuard)
@RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.MARKETING_ADMIN)
@Controller('admin/comms')
export class CommsController {
  constructor(private readonly commsService: CommsService) {}

  @Post('preview')
  async preview(@Body() dto: BulkSendPreviewDto) {
    return this.commsService.preview(dto);
  }

  @Post('dispatch')
  async dispatch(@Body() dto: BulkSendDispatchDto, @Req() req: any) {
    return this.commsService.dispatch(dto, req.adminUser, req.ip, req.headers['user-agent']);
  }

  @Get('history')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.MARKETING_ADMIN, AdminRole.OPERATIONS_ADMIN)
  async getHistory(
    @Query('page') page: number | undefined,
    @Query('limit') limit: number | undefined,
  ) {
    return this.commsService.getHistory(page, limit);
  }
}
