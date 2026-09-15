import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { RouterActionService } from './router-action.service';
import { InvoiceStatus } from '@prisma/client';

@Injectable()
export class BillingSuspendJob {
  private readonly logger = new Logger(BillingSuspendJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly routerActionService: RouterActionService,
  ) {}

  /**
   * Runs every hour.
   * Finds ISP invoices that are overdue (dueDate in the past, not yet paid,
   * and not yet auto-suspended) and suspends the subscriber on their router.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleOverdueInvoices() {
    this.logger.log('BillingSuspendJob: checking for overdue ISP invoices...');

    const overdueInvoices = await this.prisma.db.invoice.findMany({
      where: {
        subscriberId: { not: null },
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL] },
        dueDate: { lt: new Date() },
        suspendedForNonPayment: false,
      },
      include: {
        subscriber: true,
      },
    });

    if (!overdueInvoices.length) {
      this.logger.debug('BillingSuspendJob: no overdue invoices found');
      return;
    }

    this.logger.log(`BillingSuspendJob: found ${overdueInvoices.length} overdue invoice(s) to process`);

    for (const invoice of overdueInvoices) {
      if (!invoice.subscriber || !invoice.subscriber.routerId) {
        // Subscriber has no router linked — mark as processed so we don't retry endlessly
        await this.prisma.db.invoice.update({
          where: { id: invoice.id },
          data: { suspendedForNonPayment: true },
        });
        this.logger.debug(
          `BillingSuspendJob: invoice ${invoice.id} — subscriber has no router, marking processed`,
        );
        continue;
      }

      const result = await this.routerActionService.suspend(
        invoice.subscriber.organizationId,
        invoice.subscriber.id,
        'billing',
      );

      // Mark the invoice as processed regardless of router success/failure
      // (RouterAction record captures the outcome; retries happen inside RouterActionService)
      await this.prisma.db.invoice.update({
        where: { id: invoice.id },
        data: { suspendedForNonPayment: true },
      });

      if (!result.success) {
        this.logger.warn(
          `BillingSuspendJob: suspend FAILED for subscriber ${invoice.subscriber.id} — ${result.error}`,
        );
      }
    }

    this.logger.log('BillingSuspendJob: done');
  }
}
