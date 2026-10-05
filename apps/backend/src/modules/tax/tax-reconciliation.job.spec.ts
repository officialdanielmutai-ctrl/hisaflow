import { TaxReconciliationService } from './tax-reconciliation.service';
import { TaxReconciliationJob } from './tax-reconciliation.job';

function build() {
  const reconciliation: any = { runAll: jest.fn(async () => ({ checked: 0, flagged: 0 })) };
  return {
    service: new TaxReconciliationJob(reconciliation as unknown as TaxReconciliationService),
    reconciliation,
  };
}

describe('TaxReconciliationJob', () => {
  it('runs the reconciliation sweep', async () => {
    const { service, reconciliation } = build();
    reconciliation.runAll.mockResolvedValue({ checked: 5, flagged: 1 });

    await service.handle();

    expect(reconciliation.runAll).toHaveBeenCalledTimes(1);
  });

  it('never throws when the service fails', async () => {
    const { service, reconciliation } = build();
    reconciliation.runAll.mockRejectedValue(new Error('kra down'));

    await expect(service.handle()).resolves.toBeUndefined();
  });
});
