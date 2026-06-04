import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { AiIngestionModule } from './modules/ai-ingestion/ai-ingestion.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    CoreModule,
    ConfigModule,
    DatabaseModule,
    OrganizationsModule,
    InventoryModule,
    TransactionsModule,
    AiIngestionModule,
    AlertsModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
