import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AssistantCommsService,
  normalizePhone,
  normalizeRecipient,
} from './assistant-comms.service';

const originalResend = process.env.RESEND_API_KEY;
const originalAt = process.env.AFRICAS_TALKING_API_KEY;

function build(consentRecord: Record<string, unknown> | null = null) {
  const db = {
    communicationConsent: { findFirst: jest.fn(async () => consentRecord) },
    assistantOutboundMessage: { create: jest.fn(async () => ({})) },
  };
  const config = { get: jest.fn(() => undefined) };
  const service = new AssistantCommsService(
    { db } as never,
    config as unknown as ConfigService,
  );
  return { service, db };
}

afterAll(() => {
  if (originalResend === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalResend;
  if (originalAt === undefined) delete process.env.AFRICAS_TALKING_API_KEY;
  else process.env.AFRICAS_TALKING_API_KEY = originalAt;
});

describe('recipient normalisation', () => {
  it('normalises Kenyan phone numbers', () => {
    expect(normalizePhone('0712345678')).toBe('+254712345678');
    expect(normalizePhone('254712345678')).toBe('+254712345678');
    expect(normalizePhone('+254 712 345 678')).toBe('+254712345678');
  });

  it('lowercases and trims emails, normalises phones', () => {
    expect(normalizeRecipient('EMAIL', ' A@B.com ')).toBe('a@b.com');
    expect(normalizeRecipient('SMS', '0712345678')).toBe('+254712345678');
  });
});

describe('AssistantCommsService', () => {
  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.AFRICAS_TALKING_API_KEY;
  });

  it('blocks a recipient who has opted out', async () => {
    const { service } = build({
      emailStatus: 'OPTED_OUT',
      smsStatus: 'OPTED_IN',
    });

    await expect(
      service.assertConsent('org_1', 'EMAIL', 'a@b.com'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a recipient with no opt-out record', async () => {
    const { service } = build(null);
    await expect(
      service.assertConsent('org_1', 'SMS', '0712345678'),
    ).resolves.toBeUndefined();
  });

  it('sends in mock mode and records the outbound message', async () => {
    const { service, db } = build(null);

    const result = await service.send({
      organizationId: 'org_1',
      userId: 'user_1',
      channel: 'SMS',
      recipient: '0712345678',
      message: 'Hello',
    });

    expect(result).toEqual({ status: 'MOCKED', recipient: '+254712345678' });
    expect(db.assistantOutboundMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org_1',
        channel: 'SMS',
        recipient: '+254712345678',
        status: 'MOCKED',
      }),
    });
  });

  it('does not send or record when the recipient opted out', async () => {
    const { service, db } = build({
      emailStatus: 'OPTED_OUT',
      smsStatus: 'OPTED_IN',
    });

    await expect(
      service.send({
        organizationId: 'org_1',
        userId: 'user_1',
        channel: 'EMAIL',
        recipient: 'a@b.com',
        message: 'Hello',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.assistantOutboundMessage.create).not.toHaveBeenCalled();
  });
});
