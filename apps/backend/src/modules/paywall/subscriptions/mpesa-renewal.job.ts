import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MpesaRenewalService } from './mpesa-renewal.service';

/**
 * Phase C scheduled loop. Hourly, like the ISP vertical's `BillingSuspendJob`;
 * the day-based retry offsets (0/2/4) are enforced inside the service, so an
 * hourly tick is safe and just means reminders/charges land promptly.
 *
 * Note: `ScheduleModule.forRoot()` is registered once via the ISP module; the
 * `@Cron` decorator here is discovered by that global scheduler. If the
 * scheduler root is ever moved, this job moves with it.
 */
@Injectable()
export class MpesaRenewalJob {
  private readonly logger = new Logger(MpesaRenewalJob.name);

  constructor(private readonly renewals: MpesaRenewalService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handle(): Promise<void> {
    try {
      const reminders = await this.renewals.sendDueReminders();
      const result = await this.renewals.processDueSubscriptions();

      if (reminders > 0 || result.charged > 0 || result.movedToGrace > 0) {
        this.logger.log(
          `M-Pesa renewal run: reminders=${reminders}, processed=${result.processed}, charged=${result.charged}, grace=${result.movedToGrace}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `M-Pesa renewal job failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
