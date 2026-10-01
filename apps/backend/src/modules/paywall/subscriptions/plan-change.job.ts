import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BillingService } from './billing.service';

/**
 * Phase E deferred-downgrade applier. Hourly, like the M-Pesa renewal job, so
 * a scheduled downgrade lands promptly once its `pendingPlanEffectiveAt` has
 * passed. The service enforces the date check, so an hourly tick is safe.
 *
 * Note: `ScheduleModule.forRoot()` is registered once via the ISP module (see
 * open finding F-11); this `@Cron` is discovered by that global scheduler.
 */
@Injectable()
export class PlanChangeJob {
  private readonly logger = new Logger(PlanChangeJob.name);

  constructor(private readonly billing: BillingService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handle(): Promise<void> {
    try {
      const result = await this.billing.applyDuePlanChanges();
      if (result.applied > 0) {
        this.logger.log(
          `Plan-change run: processed=${result.processed}, applied=${result.applied}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Plan-change job failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
