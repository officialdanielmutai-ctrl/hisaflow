import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { TaxRegistrationController } from './tax-registration.controller';
import { TaxRegistrationService } from './tax-registration.service';
import { InvoiceTaxService } from './invoice-tax.service';
import { TaxFilingService } from './tax-filing.service';
import { TaxSyncController } from './tax-sync.controller';
import { TaxSyncService } from './tax-sync.service';
import { TaxSyncJob } from './tax-sync.job';
import { TaxReportController } from './tax-report.controller';
import { TaxReportService } from './tax-report.service';
import { TaxReconciliationController } from './tax-reconciliation.controller';
import { TaxReconciliationService } from './tax-reconciliation.service';
import { TaxReconciliationJob } from './tax-reconciliation.job';
import { TaxAggregationController } from './tax-aggregation.controller';
import { TaxAggregationService } from './tax-aggregation.service';
import { VscuClient } from './vscu/vscu.client';

/**
 * Tax system (KRA eTIMS).
 *
 * Phase A: per-organization registration tracking.
 * Phase B: `InvoiceTaxService` is the single choke point that creates every
 *   `Invoice`/`InvoiceLineItem` and calculates standard VAT automatically.
 * Phase C: `TaxFilingService` records each tax invoice, `VscuClient` signs
 *   locally, and `TaxSyncService`/`TaxSyncJob` drain the offline queue to KRA.
 */
@Module({
  imports: [NotificationsModule],
  controllers: [
    TaxRegistrationController,
    TaxSyncController,
    TaxReportController,
    TaxReconciliationController,
    TaxAggregationController,
  ],
  providers: [
    TaxRegistrationService,
    InvoiceTaxService,
    TaxFilingService,
    VscuClient,
    TaxSyncService,
    TaxSyncJob,
    TaxReportService,
    TaxReconciliationService,
    TaxReconciliationJob,
    TaxAggregationService,
  ],
  exports: [TaxRegistrationService, InvoiceTaxService, TaxSyncService],
})
export class TaxModule {}
