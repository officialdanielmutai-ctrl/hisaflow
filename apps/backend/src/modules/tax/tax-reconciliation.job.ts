import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TaxReconciliationService } from './tax-reconciliation.service';

/**
 * Phase E scheduled reconciliation. Runs daily (before the monthly VAT
 * deadline) so mismatches surface ahead of filing rather than after. The
 * service is entitlement-checked, so only Team/Growth orgs are flagged.
 *
 * Note: `ScheduleModule.forRoot()` is registered once via the ISP module (see
 * open finding F-11); this `@Cron` is discovered by that global scheduler.
 */
@Injectable()
export class TaxReconciliationJob {
  private readonly logger = new Logger(TaxReconciliationJob.name);

  constructor(
    private readonly reconciliation: TaxReconciliationService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async handle(): Promise<void> {
    try {
      const result = await this.reconciliation.runAll();
      if (result.flagged > 0) {
        this.logger.log(
          `Tax reconciliation run: checked=${result.checked}, flagged=${result.flagged}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Tax reconciliation job failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
