import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { VerticalAnalyticsService } from './vertical-analytics.service';
import { PrismaService } from '../../infrastructure/prisma.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, VerticalAnalyticsService],
  exports: [AnalyticsService, VerticalAnalyticsService],
})
export class AnalyticsModule {}
