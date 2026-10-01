import { ConfigService } from '@nestjs/config';
import { WebhookEvent } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { PaystackService } from '../paystack/paystack.service';
import { PaystackWebhookPayload } from '../paystack/paystack.types';
import { PaystackEventHandlerService } from './paystack-event-handler.service';
import { PaystackWebhookService } from './paystack-webhook.service';

function configWithSecret(): ConfigService {
  return {
    get: (key: string) =>
      key === 'paystack.secretKey' ? 'sk_test_secret' : undefined,
  } as unknown as ConfigService;
}

function payload(overrides: Partial<PaystackWebhookPayload> = {}): PaystackWebhookPayload {
  return {
    event: 'charge.success',
    data: { reference: 'ref_abc', amount: 250000 },
    ...overrides,
  } as PaystackWebhookPayload;
}

interface CreateArgs {
  data: {
    eventType: string;
    idempotencyKey: string;
    paystackReference?: string | null;
    payload?: unknown;
  };
}

function createPrismaMock() {
  const store = new Map<string, WebhookEvent>();
  let seq = 0;
  const mock = {
    db: {
      webhookEvent: {
        create: async ({ data }: CreateArgs): Promise<WebhookEvent> => {
          if (store.has(data.idempotencyKey)) {
            const err = new Error('P2002') as Error & { code?: string };
            err.code = 'P2002';
            throw err;
          }
          const row = {
            id: `we_${++seq}`,
            provider: 'paystack',
            eventType: data.eventType,
            paystackReference: data.paystackReference ?? null,
            idempotencyKey: data.idempotencyKey,
            organizationId: null,
            status: 'RECEIVED',
            payload: data.payload ?? {},
            errorMessage: null,
            receivedAt: new Date(),
            processedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as unknown as WebhookEvent;
          store.set(row.idempotencyKey, row);
          return row;
        },
        findUnique: async ({
          where,
        }: {
          where: { idempotencyKey: string };
        }): Promise<WebhookEvent | null> =>
          store.get(where.idempotencyKey) ?? null,
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }): Promise<WebhookEvent> => {
          const row = [...store.values()].find((r) => r.id === where.id);
          if (!row) throw new Error('missing row');
          return Object.assign(row, data) as WebhookEvent;
        },
      },
    },
  };
  return { mock: mock as unknown as PrismaService, store };
}

describe('PaystackWebhookService', () => {
  let store: Map<string, WebhookEvent>;
  let service: PaystackWebhookService;

  beforeEach(() => {
    const prisma = createPrismaMock();
    store = prisma.store;
    const eventHandler = {
      handle: async () => undefined,
    } as unknown as PaystackEventHandlerService;
    service = new PaystackWebhookService(
      prisma.mock,
      new PaystackService(configWithSecret()),
      eventHandler,
    );
  });

  it('keys idempotency on the Paystack transaction reference for charge events', () => {
    expect(service.buildIdempotencyKey(payload())).toBe(
      'charge.success:ref_abc',
    );
  });

  it('falls back to the subscription code for subscription events', () => {
    expect(
      service.buildIdempotencyKey(
        payload({
          event: 'subscription.create',
          data: { subscription_code: 'SUB_123' } as PaystackWebhookPayload['data'],
        }),
      ),
    ).toBe('subscription.create:SUB_123');
  });

  it('falls back to a payload hash when there is no Paystack identifier', () => {
    const event = payload({
      event: 'transfer.success',
      data: { amount: 1000 } as PaystackWebhookPayload['data'],
    });
    const key = service.buildIdempotencyKey(event);
    expect(key.startsWith('transfer.success:sha256:')).toBe(true);
    // Deterministic for the exact same payload.
    expect(service.buildIdempotencyKey(event)).toBe(key);
  });

  it('persists a verified event and marks it processed', async () => {
    const result = await service.persistEvent(payload());

    expect(result.duplicate).toBe(false);
    expect(result.event).not.toBeNull();
    expect(store.size).toBe(1);

    await service.processEvent(result.event!, payload());

    const stored = [...store.values()][0];
    expect(stored.status).toBe('PROCESSED');
    expect(stored.processedAt).toBeInstanceOf(Date);
  });

  it('treats a replayed event as a duplicate instead of writing a second row', async () => {
    const first = await service.persistEvent(payload());
    const second = await service.persistEvent(payload());

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(store.size).toBe(1);
  });
});
