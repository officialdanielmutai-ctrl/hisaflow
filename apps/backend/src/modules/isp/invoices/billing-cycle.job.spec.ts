import { BillingCycle } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { IspInvoicesService } from './isp-invoices.service';
import {
  IspBillingCycleJob,
  currentCycleStart,
} from './billing-cycle.job';

const ORG = 'org_a';
const NOW = new Date('2026-11-06T10:00:00.000Z');

function build(opts: { existingInvoice?: boolean } = {}) {
  const subscriberFindMany = jest.fn(async () => [
    {
      id: 'sub_1',
      organizationId: ORG,
      status: 'ACTIVE',
      createdAt: new Date('2026-01-15T00:00:00.000Z'),
      planId: 'plan_1',
      plan: { id: 'plan_1', billingCycle: BillingCycle.MONTHLY },
    },
  ]);
  const invoiceFindFirst = jest.fn(async () =>
    opts.existingInvoice ? { id: 'inv_existing' } : null,
  );
  const prisma = {
    db: {
      subscriber: { findMany: subscriberFindMany },
      invoice: { findFirst: invoiceFindFirst },
    },
  } as unknown as PrismaService;

  const generateForSubscriber = jest.fn(async () => ({ id: 'inv_new' }));
  const issue = jest.fn(async () => ({ id: 'inv_new', status: 'ISSUED' }));
  const invoices = {
    generateForSubscriber,
    issue,
  } as unknown as IspInvoicesService;

  return {
    service: new IspBillingCycleJob(prisma, invoices),
    subscriberFindMany,
    invoiceFindFirst,
    generateForSubscriber,
    issue,
  };
}

describe('currentCycleStart', () => {
  it('anchors a monthly cycle to the subscriber day of month', () => {
    const start = currentCycleStart(
      new Date('2026-01-15T09:30:00.000Z'),
      BillingCycle.MONTHLY,
      NOW,
    );

    expect(start.toISOString()).toBe('2026-10-15T09:30:00.000Z');
  });

  it('goes back to the previous month when this month is not due yet', () => {
    const start = currentCycleStart(
      new Date('2026-01-20T00:00:00.000Z'),
      BillingCycle.MONTHLY,
      new Date('2026-11-06T10:00:00.000Z'),
    );

    expect(start.toISOString()).toBe('2026-10-20T00:00:00.000Z');
  });

  it('clamps the 31st to the last day of a shorter month', () => {
    const start = currentCycleStart(
      new Date('2026-01-31T00:00:00.000Z'),
      BillingCycle.MONTHLY,
      new Date('2026-03-01T00:00:00.000Z'),
    );

    expect(start.toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });

  it('supports quarterly and annual cycles', () => {
    const anchor = new Date('2026-01-01T08:00:00.000Z');

    expect(
      currentCycleStart(anchor, BillingCycle.QUARTERLY, NOW).toISOString(),
    ).toBe('2026-10-01T08:00:00.000Z');
    expect(
      currentCycleStart(anchor, BillingCycle.ANNUALLY, NOW).toISOString(),
    ).toBe('2026-01-01T08:00:00.000Z');
  });
});

describe('IspBillingCycleJob', () => {
  it('generates and issues an invoice when this cycle has none', async () => {
    const { service, generateForSubscriber, issue } = build();

    await service.handleBillingCycle();

    expect(generateForSubscriber).toHaveBeenCalledWith(
      ORG,
      expect.objectContaining({ subscriberId: 'sub_1' }),
    );
    expect(issue).toHaveBeenCalledWith(ORG, 'inv_new');
  });

  it('does not duplicate an invoice already created this cycle', async () => {
    const { service, generateForSubscriber } = build({ existingInvoice: true });

    await service.handleBillingCycle();

    expect(generateForSubscriber).not.toHaveBeenCalled();
  });
});
