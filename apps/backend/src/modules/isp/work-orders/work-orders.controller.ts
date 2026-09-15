import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { WorkOrdersService } from './work-orders.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { ClerkAuthGuard } from '../../../core/guards/clerk-auth.guard';
import { OrgContext } from '../../../core/decorators/org-context.decorator';
import { WorkOrderStatus } from '@prisma/client';

@Controller('work-orders')
@UseGuards(ClerkAuthGuard)
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Post()
  create(@OrgContext() orgId: string, @Body() dto: CreateWorkOrderDto) {
    return this.workOrdersService.create(orgId, dto);
  }

  @Get()
  findAll(
    @OrgContext() orgId: string,
    @Query('status') status?: WorkOrderStatus,
    @Query('subscriberId') subscriberId?: string,
  ) {
    return this.workOrdersService.findAll(orgId, status, subscriberId);
  }

  @Get(':id')
  findOne(@OrgContext() orgId: string, @Param('id') id: string) {
    return this.workOrdersService.findOne(orgId, id);
  }

  @Patch(':id')
  update(@OrgContext() orgId: string, @Param('id') id: string, @Body() dto: UpdateWorkOrderDto) {
    return this.workOrdersService.update(orgId, id, dto);
  }

  @Patch(':id/start')
  start(@OrgContext() orgId: string, @Param('id') id: string) {
    return this.workOrdersService.transition(orgId, id, WorkOrderStatus.IN_PROGRESS);
  }

  @Patch(':id/complete')
  complete(@OrgContext() orgId: string, @Param('id') id: string) {
    return this.workOrdersService.transition(orgId, id, WorkOrderStatus.COMPLETED);
  }

  @Patch(':id/cancel')
  cancel(@OrgContext() orgId: string, @Param('id') id: string) {
    return this.workOrdersService.transition(orgId, id, WorkOrderStatus.CANCELLED);
  }
}
