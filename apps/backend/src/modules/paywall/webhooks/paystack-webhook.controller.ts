import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PaystackWebhookService } from './paystack-webhook.service';
import { PaystackWebhookPayload } from '../paystack/paystack.types';

/**
 * Paystack webhook receiver (Phase A).
 *
 * Public by design — Paystack cannot present a Clerk session. Trust comes
 * entirely from the HMAC-SHA512 signature check over the raw body (Section 3.4),
 * so this route must never be placed behind ClerkAuthGuard.
 */
@Controller('webhooks/paystack')
export class PaystackWebhookController {
  private readonly logger = new Logger(PaystackWebhookController.name);

  constructor(private readonly webhooks: PaystackWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature?: string,
  ): Promise<{ received: boolean }> {
    const rawBody = req.rawBody;

    // 1. Verify the signature against the raw bytes. Invalid/missing signatures
    //    are rejected with 401 and never touch the database.
    if (!this.webhooks.verifySignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid Paystack webhook signature');
    }

    // 2. Parse only after the signature is trusted.
    let payload: PaystackWebhookPayload;
    try {
      payload = JSON.parse((rawBody as Buffer).toString('utf8'));
    } catch {
      throw new BadRequestException('Malformed Paystack webhook payload');
    }

    if (!payload || typeof payload.event !== 'string') {
      throw new BadRequestException('Paystack webhook payload is missing an event type');
    }

    // 3. Durably log the verified event and enforce idempotency before ack'ing.
    const { duplicate, event } = await this.webhooks.persistEvent(payload);

    if (duplicate || !event) {
      // A replayed delivery is success — Paystack should stop retrying.
      return { received: true };
    }

    // 4. Acknowledge within Paystack's ~30s timeout. The raw event is already
    //    logged above; business processing runs after the response so it can
    //    never delay (or fail) the acknowledgement.
    void this.webhooks.processEvent(event, payload).catch((err) => {
      this.logger.error(
        `Background webhook processing failed for ${event.id}: ${
          err instanceof Error ? err.message : err
        }`,
      );
    });

    return { received: true };
  }
}
