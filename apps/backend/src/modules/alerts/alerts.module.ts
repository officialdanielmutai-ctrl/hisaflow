import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AfricasTalkingProvider } from '../../infrastructure/providers/africas-talking.provider';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [AlertsController],
  providers: [AlertsService, AfricasTalkingProvider],
  exports: [AlertsService],
})
export class AlertsModule {}
