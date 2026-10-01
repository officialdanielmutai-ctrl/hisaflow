import { Injectable, Logger } from '@nestjs/common';
import {
  asString,
  PaystackWebhookPayload,
} from '../paystack/paystack.types';
import { CardSubscriptionService } from '../subscriptions/card-subscription.service';
import { MpesaRenewalService } from '../subscriptions/mpesa-renewal.service';

/**
 * Routes verified webhook events to the right owner.
 *
 * Card and M-Pesa are architecturally different (Section 3.1 vs 3.2) and stay
 * separate code paths: this dispatcher picks the owner from the payload
 * `channel`, and neither service knows about the other.
 */
@Injectable()
export class PaystackEventHandlerService {
  private readonly logger = new Logger(PaystackEventHandlerService.name);

  constructor(
    private readonly cardSubscriptions: CardSubscriptionService,
    private readonly mpesaRenewals: MpesaRenewalService,
  ) {}

  async handle(payload: PaystackWebhookPayload): Promise<void> {
    const data = payload.data ?? {};
    const channel = asString(data.channel)?.toLowerCase();
    const isMobileMoney = channel === 'mobile_money';

    switch (payload.event) {
      case 'charge.success':
        // Phase C owns M-Pesa; Phase B owns card.
        if (isMobileMoney) {
          await this.mpesaRenewals.handleChargeSuccess(data);
        } else {
          await this.cardSubscriptions.handleChargeSuccess(data);
        }
        return;
      case 'charge.failed':
        if (isMobileMoney) {
          await this.mpesaRenewals.handleChargeFailed(data);
        } else {
          // Card failures surface as invoice.payment_failed (Phase B).
          this.logger.log('charge.failed (non mobile_money) received');
        }
        return;
      case 'subscription.create':
        await this.cardSubscriptions.handleSubscriptionCreate(data);
        return;
      case 'invoice.payment_failed':
        await this.cardSubscriptions.handleInvoicePaymentFailed(data);
        return;
      case 'subscription.disable':
        // Phase E owns plan changes; disabling a Paystack subscription there is
        // not the same as suspending the org, so no state change here.
        this.logger.log(
          'subscription.disable received — Phase E owns subscription changes',
        );
        return;
      default:
        this.logger.log(`Unhandled Paystack event type: ${payload.event}`);
    }
  }
}
