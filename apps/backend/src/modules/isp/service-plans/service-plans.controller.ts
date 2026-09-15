import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ServicePlansService } from './service-plans.service';
import { CreateServicePlanDto } from './dto/create-service-plan.dto';
import { UpdateServicePlanDto } from './dto/update-service-plan.dto';
import { ClerkAuthGuard } from '../../../core/guards/clerk-auth.guard';
import { OrgContext } from '../../../core/decorators/org-context.decorator';

@Controller('service-plans')
@UseGuards(ClerkAuthGuard)
export class ServicePlansController {
  constructor(private readonly servicePlansService: ServicePlansService) {}

  @Post()
  create(@OrgContext() orgId: string, @Body() dto: CreateServicePlanDto) {
    return this.servicePlansService.create(orgId, dto);
  }

  @Get()
  findAll(@OrgContext() orgId: string, @Query('activeOnly') activeOnly?: string) {
    return this.servicePlansService.findAll(orgId, activeOnly === 'true' ? true : undefined);
  }

  @Get(':id')
  findOne(@OrgContext() orgId: string, @Param('id') id: string) {
    return this.servicePlansService.findOne(orgId, id);
  }

  @Patch(':id')
  update(@OrgContext() orgId: string, @Param('id') id: string, @Body() dto: UpdateServicePlanDto) {
    return this.servicePlansService.update(orgId, id, dto);
  }

  @Delete(':id')
  remove(@OrgContext() orgId: string, @Param('id') id: string) {
    return this.servicePlansService.remove(orgId, id);
  }
}
