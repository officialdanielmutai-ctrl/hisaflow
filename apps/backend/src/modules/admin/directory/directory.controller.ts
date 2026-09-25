import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { RequireAdminRoles } from '../decorators/require-admin-roles.decorator';
import { AdminRole } from '@prisma/client';
import { DirectoryService } from './directory.service';

class UpdateConsentDto {
  emailStatus?: 'OPTED_IN' | 'OPTED_OUT';
  smsStatus?: 'OPTED_IN' | 'OPTED_OUT';
}

@UseGuards(AdminAuthGuard, AdminRoleGuard)
@RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_ADMIN, AdminRole.MARKETING_ADMIN)
@Controller('admin/directory')
export class DirectoryController {
  constructor(private readonly directoryService: DirectoryService) {}

  @Get('users')
  async listUsers(
    @Query('search') search: string | undefined,
    @Query('limit') limit: number | undefined,
    @Query('offset') offset: number | undefined,
  ) {
    return this.directoryService.listUsers(search, limit, offset);
  }

  @Get('users/export')
  async exportCsv(
    @Query('search') search: string | undefined,
    @Res() res: Response,
  ) {
    const csv = await this.directoryService.exportUsersCsv(search);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="hisaflow-users.csv"');
    res.send(csv);
  }

  @Get('users/:clerkId')
  async getUser(@Param('clerkId') clerkId: string) {
    return this.directoryService.getUser(clerkId);
  }

  @Patch('users/:clerkId/consent')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.MARKETING_ADMIN)
  async updateConsent(
    @Param('clerkId') clerkId: string,
    @Body() body: UpdateConsentDto,
    @Req() req: any,
  ) {
    return this.directoryService.updateConsent(
      clerkId,
      body.emailStatus,
      body.smsStatus,
      req.adminUser,
      req.ip,
      req.headers['user-agent'],
    );
  }
}
