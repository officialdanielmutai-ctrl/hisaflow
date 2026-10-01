import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PaystackService } from './paystack.service';

const SECRET = 'sk_test_hisaflow_paystack_secret';

function configWith(secret: string): ConfigService {
  return {
    get: (key: string) =>
      key === 'paystack.secretKey'
        ? secret
        : key === 'paystack.baseUrl'
          ? 'https://api.paystack.co'
          : undefined,
  } as unknown as ConfigService;
}

function sign(body: string | Buffer, secret = SECRET): string {
  return crypto.createHmac('sha512', secret).update(body).digest('hex');
}

describe('PaystackService webhook signature verification (Section 3.4)', () => {
  const body = JSON.stringify({
    event: 'charge.success',
    data: { reference: 'ref_phase_a_001', amount: 250000, status: 'success' },
  });

  afterEach(() => {
    delete process.env.PAYSTACK_SECRET_KEY;
  });

  it('accepts a signature computed over the exact raw body', () => {
    const service = new PaystackService(configWith(SECRET));
    expect(service.verifyWebhookSignature(Buffer.from(body), sign(body))).toBe(
      true,
    );
  });

  it('rejects an intentionally invalid signature (wrong secret)', () => {
    const service = new PaystackService(configWith(SECRET));
    const invalid = sign(body, 'sk_test_a_different_secret');
    expect(service.verifyWebhookSignature(Buffer.from(body), invalid)).toBe(
      false,
    );
  });

  it('rejects a valid signature once the body is tampered with', () => {
    const service = new PaystackService(configWith(SECRET));
    const originalSignature = sign(body);
    const tampered = body.replace('250000', '999999');
    expect(
      service.verifyWebhookSignature(Buffer.from(tampered), originalSignature),
    ).toBe(false);
  });

  it('rejects a re-serialized body (the parse-then-stringify mistake)', () => {
    const service = new PaystackService(configWith(SECRET));
    // Intentionally unsorted/spaced so JSON.stringify(JSON.parse(x)) differs
    // from x, which is exactly the bug Section 3.4 warns about.
    const original =
      '{ "event": "charge.success", "data": { "amount": 250000, "reference": "ref_1" } }';
    const reserialized = JSON.stringify(JSON.parse(original));
    expect(reserialized).not.toBe(original);

    const signature = sign(original);
    expect(service.verifyWebhookSignature(Buffer.from(original), signature)).toBe(
      true,
    );
    expect(
      service.verifyWebhookSignature(Buffer.from(reserialized), signature),
    ).toBe(false);
  });

  it('returns false for missing, empty, or malformed signatures', () => {
    const service = new PaystackService(configWith(SECRET));
    expect(service.verifyWebhookSignature(Buffer.from(body), undefined)).toBe(
      false,
    );
    expect(service.verifyWebhookSignature(Buffer.from(body), '')).toBe(false);
    expect(service.verifyWebhookSignature(Buffer.from(body), 'not-hex')).toBe(
      false,
    );
    expect(service.verifyWebhookSignature(undefined, sign(body))).toBe(false);
  });

  it('fails closed when no secret key is configured', () => {
    const service = new PaystackService(configWith(''));
    expect(service.verifyWebhookSignature(Buffer.from(body), sign(body))).toBe(
      false,
    );
  });
});
