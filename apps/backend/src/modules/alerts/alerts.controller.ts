import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { OrgContext } from '../../core/decorators/org-context.decorator';

@UseGuards(ClerkAuthGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  getActive(@OrgContext() orgId: string) {
    return this.alertsService.getActiveAlerts(orgId);
  }

  @Post('check')
  async checkLowStock(@OrgContext() orgId: string) {
    return this.alertsService.checkLowStock(orgId);
  }
}
