import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BillingCycle, InvoiceStatus, SubscriberStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { IspInvoicesService } from './isp-invoices.service';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getDate();
  const copy = new Date(date);
  copy.setDate(1);
  copy.setMonth(copy.getMonth() + months);
  const daysInMonth = new Date(copy.getFullYear(), copy.getMonth() + 1, 0).getDate();
  copy.setDate(Math.min(day, daysInMonth));
  return copy;
}

/**
 * The start of the subscriber's current billing period, anchored to the day
 * they were added. Pure so the cycle maths can be tested without a scheduler.
 */
export function currentCycleStart(
  anchor: Date,
  cycle: BillingCycle,
  now: Date,
): Date {
  const months =
    cycle === BillingCycle.QUARTERLY
      ? 3
      : cycle === BillingCycle.ANNUALLY
        ? 12
        : 1;

  if (anchor > now) {
    return startOfDay(now);
  }

  let start = new Date(anchor);
  for (let step = 1; step <= 2400; step += 1) {
    const next = addMonthsClamped(anchor, step * months);
    if (next > now) break;
    start = next;
  }
  return start;
}

@Injectable()
export class IspBillingCycleJob {
  private readonly logger = new Logger(IspBillingCycleJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: IspInvoicesService,
  ) {}

  /**
   * Runs once a day at 06:00. Creates (and issues) one invoice per active
   * subscriber for the billing period they are currently in. Idempotent: an
   * invoice already created in this period is never duplicated.
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async handleBillingCycle() {
    const now = new Date();
    this.logger.log('IspBillingCycleJob: checking subscriber billing cycles...');

    const subscribers = await this.prisma.db.subscriber.findMany({
      where: {
        status: SubscriberStatus.ACTIVE,
        planId: { not: null },
      },
      include: { plan: true },
    });

    let generated = 0;

    for (const subscriber of subscribers) {
      if (!subscriber.plan) continue;

      const cycleStart = currentCycleStart(
        subscriber.createdAt,
        subscriber.plan.billingCycle,
        now,
      );

      const existing = await this.prisma.db.invoice.findFirst({
        where: {
          organizationId: subscriber.organizationId,
          subscriberId: subscriber.id,
          status: { not: InvoiceStatus.VOIDED },
          createdAt: { gte: cycleStart },
        },
        select: { id: true },
      });

      if (existing) continue;

      try {
        const invoice = await this.invoices.generateForSubscriber(
          subscriber.organizationId,
          {
            subscriberId: subscriber.id,
            dueDate: new Date(cycleStart.getTime() + 7 * DAY_MS).toISOString(),
          },
        );

        if (invoice?.id) {
          await this.invoices.issue(subscriber.organizationId, invoice.id);
          generated += 1;
        }
      } catch (error) {
        this.logger.warn(
          `IspBillingCycleJob: could not bill subscriber ${subscriber.id} — ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }

    this.logger.log(
      `IspBillingCycleJob: done — ${generated} invoice(s) generated`,
    );
  }
}
