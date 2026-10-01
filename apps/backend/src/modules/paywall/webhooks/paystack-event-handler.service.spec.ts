import { CardSubscriptionService } from '../subscriptions/card-subscription.service';
import { MpesaRenewalService } from '../subscriptions/mpesa-renewal.service';
import { PaystackEventHandlerService } from './paystack-event-handler.service';

describe('PaystackEventHandlerService (Phase B/C routing)', () => {
  const cardMock = {
    handleChargeSuccess: jest.fn(async () => undefined),
    handleSubscriptionCreate: jest.fn(async () => undefined),
    handleInvoicePaymentFailed: jest.fn(async () => undefined),
  };
  const mpesaMock = {
    handleChargeSuccess: jest.fn(async () => undefined),
    handleChargeFailed: jest.fn(async () => undefined),
  };
  const handler = new PaystackEventHandlerService(
    cardMock as unknown as CardSubscriptionService,
    mpesaMock as unknown as MpesaRenewalService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes a card charge.success into the card subscription path', async () => {
    await handler.handle({
      event: 'charge.success',
      data: { channel: 'card', reference: 'ref_card' },
    });

    expect(cardMock.handleChargeSuccess).toHaveBeenCalledWith({
      channel: 'card',
      reference: 'ref_card',
    });
    expect(mpesaMock.handleChargeSuccess).not.toHaveBeenCalled();
  });

  it('routes a mobile_money charge.success into the M-Pesa path, not the card path', async () => {
    await handler.handle({
      event: 'charge.success',
      data: { channel: 'mobile_money', reference: 'ref_mpesa' },
    });

    expect(mpesaMock.handleChargeSuccess).toHaveBeenCalledWith({
      channel: 'mobile_money',
      reference: 'ref_mpesa',
    });
    expect(cardMock.handleChargeSuccess).not.toHaveBeenCalled();
  });

  it('routes a mobile_money charge.failed into the M-Pesa path', async () => {
    await handler.handle({
      event: 'charge.failed',
      data: { channel: 'mobile_money', reference: 'ref_mpesa_fail' },
    });

    expect(mpesaMock.handleChargeFailed).toHaveBeenCalledWith({
      channel: 'mobile_money',
      reference: 'ref_mpesa_fail',
    });
    expect(cardMock.handleChargeSuccess).not.toHaveBeenCalled();
  });

  it('routes subscription.create and invoice.payment_failed to the card path', async () => {
    await handler.handle({
      event: 'subscription.create',
      data: { subscription_code: 'SUB_1' },
    });
    await handler.handle({
      event: 'invoice.payment_failed',
      data: { subscription: { subscription_code: 'SUB_1' } },
    });

    expect(cardMock.handleSubscriptionCreate).toHaveBeenCalledTimes(1);
    expect(cardMock.handleInvoicePaymentFailed).toHaveBeenCalledTimes(1);
  });
});
