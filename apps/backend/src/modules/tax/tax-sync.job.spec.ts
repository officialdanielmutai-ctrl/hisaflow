import { TaxSyncService } from './tax-sync.service';
import { TaxSyncJob } from './tax-sync.job';

function build() {
  const sync: any = {
    processQueue: jest.fn(async () => ({ processed: 0, synced: 0, offline: 0, kraErrors: 0, held: 0 })),
  };
  return { service: new TaxSyncJob(sync as unknown as TaxSyncService), sync };
}

describe('TaxSyncJob', () => {
  it('drains the offline queue', async () => {
    const { service, sync } = build();
    sync.processQueue.mockResolvedValue({ processed: 3, synced: 2, offline: 1, kraErrors: 0, held: 0 });

    await service.handle();

    expect(sync.processQueue).toHaveBeenCalledTimes(1);
  });

  it('never throws when the service fails', async () => {
    const { service, sync } = build();
    sync.processQueue.mockRejectedValue(new Error('vscu down'));

    await expect(service.handle()).resolves.toBeUndefined();
  });
});
