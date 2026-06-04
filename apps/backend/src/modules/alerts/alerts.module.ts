import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { PrismaService } from '../../infrastructure/prisma.service';

@Module({
  controllers: [AlertsController],
  providers: [AlertsService, PrismaService],
})
export class AlertsModule {}
