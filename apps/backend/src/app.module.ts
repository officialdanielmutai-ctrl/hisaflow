import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { ConfigModule } from './config/config.module';
import { PrismaService } from './infrastructure/prisma.service';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [CoreModule, ConfigModule, OrganizationsModule, InventoryModule, AnalyticsModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
