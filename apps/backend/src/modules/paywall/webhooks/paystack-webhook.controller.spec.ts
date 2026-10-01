import { ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as crypto from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { ConfigModule } from '../../../config/config.module';
import { PaystackEventHandlerService } from './paystack-event-handler.service';
import { PaywallModule } from '../paywall.module';

const SECRET = 'sk_test_hisaflow_webhook_secret';

interface StoredEvent {
  id: string;
  eventType: string;
  idempotencyKey: string;
  paystackReference: string | null;
  status: string;
  processedAt: Date | null;
  errorMessage: string | null;
  payload: unknown;
}

interface EventCreateArgs {
  data: {
    eventType: string;
    idempotencyKey: string;
    paystackReference?: string | null;
    status?: string;
    payload?: unknown;
  };
}

interface EventUpdateArgs {
  where: { id: string };
  data: {
    status?: string;
    processedAt?: Date | null;
    errorMessage?: string | null;
  };
}

function createPrismaMock() {
  const store = new Map<string, StoredEvent>();
  let sequence = 0;

  const mock = {
    db: {
      webhookEvent: {
        create: async ({ data }: EventCreateArgs): Promise<StoredEvent> => {
          if (store.has(data.idempotencyKey)) {
            const err = new Error(
              'Unique constraint failed on the fields: (`idempotency_key`)',
            );
            (err as Error & { code?: string }).code = 'P2002';
            throw err;
          }
          const row: StoredEvent = {
            id: `we_${++sequence}`,
            eventType: data.eventType,
            idempotencyKey: data.idempotencyKey,
            paystackReference: data.paystackReference ?? null,
            status: data.status ?? 'RECEIVED',
            processedAt: null,
            errorMessage: null,
            payload: data.payload,
          };
          store.set(row.idempotencyKey, row);
          return row;
        },
        findUnique: async ({
          where,
        }: {
          where: { idempotencyKey: string };
        }): Promise<StoredEvent | null> =>
          store.get(where.idempotencyKey) ?? null,
        update: async ({
          where,
          data,
        }: EventUpdateArgs): Promise<StoredEvent> => {
          const row = [...store.values()].find((r) => r.id === where.id);
          if (!row) {
            throw new Error(`No WebhookEvent with id ${where.id}`);
          }
          if (data.status !== undefined) row.status = data.status;
          if (data.processedAt !== undefined) row.processedAt = data.processedAt;
          if (data.errorMessage !== undefined)
            row.errorMessage = data.errorMessage;
          return row;
        },
      },
    },
  };

  return { mock: mock as unknown as PrismaService, store };
}

function sign(body: string, secret = SECRET): string {
  return crypto.createHmac('sha512', secret).update(body).digest('hex');
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 3000,
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('Paystack webhook endpoint (Phase A)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let store: Map<string, StoredEvent>;

  beforeAll(async () => {
    const prisma = createPrismaMock();
    store = prisma.store;

    const moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule, ConfigModule, PaywallModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma.mock)
      .overrideProvider(PaystackEventHandlerService)
      .useValue({ handle: async () => undefined })
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string) =>
          key === 'paystack.secretKey'
            ? SECRET
            : key === 'paystack.baseUrl'
              ? 'https://api.paystack.co'
              : undefined,
      })
      .compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    store.clear();
  });

  async function post(
    body: string,
    signature?: string,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (signature !== undefined) {
      headers['x-paystack-signature'] = signature;
    }
    return fetch(`${baseUrl}/webhooks/paystack`, {
      method: 'POST',
      headers,
      body,
    });
  }

  it('rejects an intentionally invalid signature with 401 and logs nothing', async () => {
    const body = JSON.stringify({
      event: 'charge.success',
      data: { reference: 'ref_invalid', amount: 250000 },
    });

    const response = await post(body, sign(body, 'wrong-secret'));

    expect(response.status).toBe(401);
    expect(store.size).toBe(0);
  });

  it('rejects a tampered body even when a signature is present', async () => {
    const original = JSON.stringify({
      event: 'charge.success',
      data: { reference: 'ref_tamper', amount: 250000 },
    });
    const tampered = original.replace('250000', '999999');

    const response = await post(tampered, sign(original));

    expect(response.status).toBe(401);
    expect(store.size).toBe(0);
  });

  it('rejects a request with no signature header', async () => {
    const body = JSON.stringify({
      event: 'charge.success',
      data: { reference: 'ref_nosig', amount: 250000 },
    });

    const response = await post(body);

    expect(response.status).toBe(401);
    expect(store.size).toBe(0);
  });

  it('accepts a valid signature, logs to WebhookEvent, and acknowledges before processing', async () => {
    const body = JSON.stringify({
      event: 'charge.success',
      data: { reference: 'ref_valid_1', amount: 250000, status: 'success' },
    });

    const response = await post(body, sign(body));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(store.size).toBe(1);

    const stored = [...store.values()][0];
    expect(stored.eventType).toBe('charge.success');
    expect(stored.paystackReference).toBe('ref_valid_1');

    // Processing runs after the 200; it must eventually stamp the event.
    await waitFor(() => [...store.values()][0]?.status === 'PROCESSED');
    const processed = [...store.values()][0];
    expect(processed.processedAt).toBeInstanceOf(Date);
  });

  it('handles duplicate deliveries idempotently (200, one log row, one processing pass)', async () => {
    const body = JSON.stringify({
      event: 'charge.success',
      data: { reference: 'ref_duplicate', amount: 250000, status: 'success' },
    });
    const signature = sign(body);

    const first = await post(body, signature);
    const second = await post(body, signature);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    await waitFor(() => [...store.values()][0]?.status === 'PROCESSED');

    expect(store.size).toBe(1);
    const stored = [...store.values()][0];
    expect(stored.idempotencyKey).toBe('charge.success:ref_duplicate');
  });

  it('does not trust a parsed body re-serialized before signature check', async () => {
    // Server always verifies the raw bytes it received. Sending a body whose
    // signature was computed over a differently-serialized version must fail.
    const signedOver = JSON.stringify({
      event: 'charge.success',
      data: { reference: 'ref_reserialize', amount: 250000 },
    });
    const actuallySent = JSON.stringify(JSON.parse(signedOver), null, 2);

    const response = await post(actuallySent, sign(signedOver));

    expect(response.status).toBe(401);
    expect(store.size).toBe(0);
  });
});
