import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { IssueEquipmentDto } from './dto/issue-equipment.dto';
import { ClerkAuthGuard } from '../../../core/guards/clerk-auth.guard';
import { OrgContext } from '../../../core/decorators/org-context.decorator';

@Controller('isp-equipment')
@UseGuards(ClerkAuthGuard)
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Post('issue')
  issue(@OrgContext() orgId: string, @Body() dto: IssueEquipmentDto) {
    return this.equipmentService.issue(orgId, dto);
  }

  @Get('subscriber/:subscriberId')
  findBySubscriber(@OrgContext() orgId: string, @Param('subscriberId') subscriberId: string) {
    return this.equipmentService.findBySubscriber(orgId, subscriberId);
  }

  @Get('work-order/:workOrderId')
  findByWorkOrder(@OrgContext() orgId: string, @Param('workOrderId') workOrderId: string) {
    return this.equipmentService.findByWorkOrder(orgId, workOrderId);
  }
}
