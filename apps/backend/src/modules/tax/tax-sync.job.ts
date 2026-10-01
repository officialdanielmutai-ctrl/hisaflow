import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TaxSyncService } from './tax-sync.service';

/**
 * Phase C background sync. Runs every 5 minutes; the service enforces
 * `nextAttemptAt` backoff and order, so a frequent tick just means a signed
 * invoice transmits promptly once connectivity returns — the offline case is
 * the point of this phase, not an edge case.
 *
 * Note: `ScheduleModule.forRoot()` is registered once via the ISP module (see
 * open finding F-11); this `@Cron` is discovered by that global scheduler.
 */
@Injectable()
export class TaxSyncJob {
  private readonly logger = new Logger(TaxSyncJob.name);

  constructor(private readonly sync: TaxSyncService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handle(): Promise<void> {
    try {
      const result = await this.sync.processQueue();
      if (result.processed > 0) {
        this.logger.log(
          `eTIMS sync run: processed=${result.processed}, synced=${result.synced}, offline=${result.offline}, kraErrors=${result.kraErrors}, held=${result.held}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `eTIMS sync job failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
