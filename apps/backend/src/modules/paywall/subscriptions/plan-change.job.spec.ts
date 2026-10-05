import { BillingService } from './billing.service';
import { PlanChangeJob } from './plan-change.job';

function build() {
  const billing: any = { applyDuePlanChanges: jest.fn(async () => ({ processed: 0, applied: 0 })) };
  return { service: new PlanChangeJob(billing as unknown as BillingService), billing };
}

describe('PlanChangeJob', () => {
  it('applies due plan changes', async () => {
    const { service, billing } = build();
    billing.applyDuePlanChanges.mockResolvedValue({ processed: 2, applied: 1 });

    await service.handle();

    expect(billing.applyDuePlanChanges).toHaveBeenCalledTimes(1);
  });

  it('never throws when the service fails', async () => {
    const { service, billing } = build();
    billing.applyDuePlanChanges.mockRejectedValue(new Error('db down'));

    await expect(service.handle()).resolves.toBeUndefined();
  });
});
