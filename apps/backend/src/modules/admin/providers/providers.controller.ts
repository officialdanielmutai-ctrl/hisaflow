import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { RequireAdminRoles } from '../decorators/require-admin-roles.decorator';
import { AdminRole } from '@prisma/client';
import { ProvidersService } from './providers.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { ReorderProvidersDto } from './dto/reorder-providers.dto';

@UseGuards(AdminAuthGuard, AdminRoleGuard)
@RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN)
@Controller('admin/providers')
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get()
  async listProviders() {
    return this.providersService.listProviders();
  }

  @Get('health')
  async checkHealth() {
    return this.providersService.checkHealth();
  }

  @Post()
  async addProvider(@Body() dto: CreateProviderDto, @Req() req: any) {
    return this.providersService.addProvider(
      dto,
      req.adminUser,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Patch(':id')
  async updateProvider(
    @Param('id') id: string,
    @Body() dto: UpdateProviderDto,
    @Req() req: any,
  ) {
    return this.providersService.updateProvider(
      id,
      dto,
      req.adminUser,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Delete(':id')
  async deleteProvider(@Param('id') id: string, @Req() req: any) {
    return this.providersService.deleteProvider(
      id,
      req.adminUser,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post('reorder')
  async reorderProviders(@Body() dto: ReorderProvidersDto, @Req() req: any) {
    return this.providersService.reorderProviders(
      dto,
      req.adminUser,
      req.ip,
      req.headers['user-agent'],
    );
  }
}
