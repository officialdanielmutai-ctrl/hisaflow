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
import { AdminRole, WorkItemPriority, WorkItemStatus } from '@prisma/client';
import { WorkQueueService } from './work-queue.service';
import { CreateWorkItemDto, UpdateWorkItemDto } from './dto/create-work-item.dto';

@UseGuards(AdminAuthGuard, AdminRoleGuard)
@RequireAdminRoles(
  AdminRole.SUPER_ADMIN,
  AdminRole.OPERATIONS_ADMIN,
  AdminRole.SUPPORT_ADMIN,
)
@Controller('admin/work-queue')
export class WorkQueueController {
  constructor(private readonly workQueueService: WorkQueueService) {}

  @Post()
  async create(@Body() dto: CreateWorkItemDto, @Req() req: any) {
    return this.workQueueService.create(
      dto,
      req.adminUser,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Get()
  async findAll(
    @Query('status') status: WorkItemStatus | undefined,
    @Query('priority') priority: WorkItemPriority | undefined,
    @Query('assignedToAdminId') assignedToAdminId: string | undefined,
    @Query('organizationId') organizationId: string | undefined,
    @Query('search') search: string | undefined,
    @Query('page') page: number | undefined,
    @Query('limit') limit: number | undefined,
  ) {
    return this.workQueueService.findAll({
      status,
      priority,
      assignedToAdminId,
      organizationId,
      search,
      page,
      limit,
    });
  }

  @Get('admins')
  async listAdmins() {
    return this.workQueueService.listAdmins();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.workQueueService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWorkItemDto,
    @Req() req: any,
  ) {
    return this.workQueueService.update(
      id,
      dto,
      req.adminUser,
      req.ip,
      req.headers['user-agent'],
    );
  }
}
