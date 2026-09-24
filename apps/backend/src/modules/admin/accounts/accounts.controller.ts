import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { RequireAdminRoles } from '../decorators/require-admin-roles.decorator';
import { AdminRole } from '@prisma/client';
import { AccountsService } from './accounts.service';
import { QueryAccountsDto } from './dto/query-accounts.dto';
import { FreezeAccountDto } from './dto/freeze-account.dto';

@UseGuards(AdminAuthGuard, AdminRoleGuard)
@RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_ADMIN)
@Controller('admin/accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  async listAccounts(@Query() query: QueryAccountsDto) {
    return this.accountsService.listAccounts(query);
  }

  @Get(':orgId')
  async getAccount(@Param('orgId') orgId: string) {
    return this.accountsService.getAccount(orgId);
  }

  @Post(':orgId/freeze')
  async freezeAccount(
    @Param('orgId') orgId: string,
    @Body() dto: FreezeAccountDto,
    @Req() req: any,
  ) {
    return this.accountsService.freezeAccount(
      orgId,
      dto.reason,
      req.adminUser,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post(':orgId/unfreeze')
  async unfreezeAccount(
    @Param('orgId') orgId: string,
    @Body() dto: FreezeAccountDto,
    @Req() req: any,
  ) {
    return this.accountsService.unfreezeAccount(
      orgId,
      dto.reason,
      req.adminUser,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Get(':orgId/history')
  async getAccountHistory(@Param('orgId') orgId: string) {
    return this.accountsService.getAccountHistory(orgId);
  }
}
