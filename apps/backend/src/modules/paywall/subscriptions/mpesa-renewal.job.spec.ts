import { MpesaRenewalService } from './mpesa-renewal.service';
import { MpesaRenewalJob } from './mpesa-renewal.job';

function build() {
  const renewals: any = {
    sendDueReminders: jest.fn(async () => 0),
    processDueSubscriptions: jest.fn(async () => ({ processed: 0, charged: 0, movedToGrace: 0 })),
  };
  return { service: new MpesaRenewalJob(renewals as unknown as MpesaRenewalService), renewals };
}

describe('MpesaRenewalJob', () => {
  it('sends reminders and processes due subscriptions', async () => {
    const { service, renewals } = build();
    renewals.sendDueReminders.mockResolvedValue(2);
    renewals.processDueSubscriptions.mockResolvedValue({ processed: 3, charged: 1, movedToGrace: 1 });

    await service.handle();

    expect(renewals.sendDueReminders).toHaveBeenCalledTimes(1);
    expect(renewals.processDueSubscriptions).toHaveBeenCalledTimes(1);
  });

  it('never throws when the service fails (cron tick must stay alive)', async () => {
    const { service, renewals } = build();
    renewals.sendDueReminders.mockRejectedValue(new Error('mpesa down'));

    await expect(service.handle()).resolves.toBeUndefined();
  });
});
