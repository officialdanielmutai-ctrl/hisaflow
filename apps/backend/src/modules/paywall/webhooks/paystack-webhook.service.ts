import { Injectable, Logger } from '@nestjs/common';
import { Prisma, WebhookEvent, WebhookEventStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { PaystackService } from '../paystack/paystack.service';
import { PaystackEventHandlerService } from './paystack-event-handler.service';
import {
  extractPaystackReference,
  PaystackWebhookPayload,
} from '../paystack/paystack.types';

export interface PersistedWebhookResult {
  duplicate: boolean;
  event: WebhookEvent | null;
}

/**
 * Owns the durability and idempotency half of webhook handling.
 *
 * The design mirrors Section 3.4:
 *  - signature verification happens in the controller before anything is written;
 *  - the raw event is persisted *before* the HTTP 200 so it is provably logged;
 *  - the unique `idempotencyKey` on WebhookEvent is the idempotency guard —
 *    a replayed delivery fails the insert instead of running business logic twice;
 *  - business processing runs after the response and only updates the log row.
 */
@Injectable()
export class PaystackWebhookService {
  private readonly logger = new Logger(PaystackWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackService,
    private readonly eventHandler: PaystackEventHandlerService,
  ) {}

  verifySignature(
    rawBody: Buffer | string | undefined | null,
    signature: string | undefined | null,
  ): boolean {
    return this.paystack.verifyWebhookSignature(rawBody, signature);
  }

  /**
   * Idempotency key keyed on Paystack's own identifier — the transaction
   * reference where one exists, otherwise the subscription/plan/customer id.
   * If an event type carries none of those (rare), fall back to a hash of the
   * whole payload so replaying the exact same body is still collapsed, while
   * distinct events are not.
   */
  buildIdempotencyKey(payload: PaystackWebhookPayload): string {
    const reference = extractPaystackReference(payload);
    if (reference) {
      return `${payload.event}:${reference}`;
    }
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    return `${payload.event}:sha256:${hash}`;
  }

  /**
   * Persist the verified webhook. Returns `{ duplicate: true }` when this exact
   * event has already been recorded, which the caller treats as success (200)
   * without reprocessing.
   */
  async persistEvent(
    payload: PaystackWebhookPayload,
  ): Promise<PersistedWebhookResult> {
    const idempotencyKey = this.buildIdempotencyKey(payload);
    const paystackReference = extractPaystackReference(payload);

    try {
      const event = await this.prisma.db.webhookEvent.create({
        data: {
          eventType: payload.event,
          paystackReference,
          idempotencyKey,
          payload: payload as unknown as Prisma.InputJsonValue,
          status: WebhookEventStatus.RECEIVED,
        },
      });
      return { duplicate: false, event };
    } catch (err) {
      if (isUniqueConstraintViolation(err)) {
        const existing = await this.prisma.db.webhookEvent.findUnique({
          where: { idempotencyKey },
        });
        this.logger.log(
          `Duplicate Paystack webhook ignored (key=${idempotencyKey})`,
        );
        return { duplicate: true, event: existing };
      }
      throw err;
    }
  }

  /**
   * Business processing, run after the HTTP 200. Delegates to the event handler
   * (Phase B routes card events; Phase C adds M-Pesa in its own branch). Never
   * rejects — failures are persisted on the event row for the admin panel.
   */
  async processEvent(
    event: WebhookEvent,
    payload: PaystackWebhookPayload,
  ): Promise<void> {
    try {
      await this.eventHandler.handle(payload);
      await this.prisma.db.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: WebhookEventStatus.PROCESSED,
          processedAt: new Date(),
          errorMessage: null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to process Paystack webhook ${event.id} (${event.eventType}): ${message}`,
      );
      await this.prisma.db.webhookEvent
        .update({
          where: { id: event.id },
          data: {
            status: WebhookEventStatus.FAILED,
            errorMessage: message,
            processedAt: new Date(),
          },
        })
        .catch((updateErr) =>
          this.logger.error(
            `Could not mark webhook ${event.id} as FAILED: ${
              updateErr instanceof Error ? updateErr.message : updateErr
            }`,
          ),
        );
    }
  }
}

function isUniqueConstraintViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === 'P2002'
  );
}
