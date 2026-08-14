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
import { FinanceModule } from './modules/finance/finance.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { NotesModule } from './modules/notes/notes.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { GuestsModule } from './modules/guests/guests.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { OcrModule } from './modules/ocr/ocr.module';
// ── Phase 1: Retail / Wholesale ──────────────────────────────────────────────
import { TieredPricingModule } from './modules/tiered-pricing/tiered-pricing.module';
// ── Phase 2: Chemist ─────────────────────────────────────────────────────────
import { StockBatchesModule } from './modules/stock-batches/stock-batches.module';
// ── Phase 3: Restaurant ──────────────────────────────────────────────────────
import { TableOrdersModule } from './modules/table-orders/table-orders.module';
// ── Phase 4: School ──────────────────────────────────────────────────────────
import { SchoolClassesModule } from './modules/school-classes/school-classes.module';
import { StudentsModule } from './modules/students/students.module';
import { AcademicTermsModule } from './modules/academic-terms/academic-terms.module';
import { SchoolFeesModule } from './modules/school-fees/school-fees.module';

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
    FinanceModule,
    NotificationsModule,
    NotesModule,
    RoomsModule,
    GuestsModule,
    BookingsModule,
    InvoicesModule,
    OcrModule,
    // Industry-specific modules
    TieredPricingModule,
    StockBatchesModule,
    TableOrdersModule,
    SchoolClassesModule,
    StudentsModule,
    AcademicTermsModule,
    SchoolFeesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

