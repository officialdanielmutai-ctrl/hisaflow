import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommunicationOptOutStatus } from '@prisma/client';
import { Resend } from 'resend';
import { PrismaService } from '../../../infrastructure/prisma.service';

export type AssistantChannel = 'SMS' | 'EMAIL';

export interface SendMessageParams {
  organizationId: string;
  userId: string;
  proposalId?: string;
  channel: AssistantChannel;
  recipient: string;
  subject?: string;
  message: string;
}

export interface SendMessageResult {
  status: 'SENT' | 'MOCKED' | 'FAILED';
  recipient: string;
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return `+254${digits.slice(1)}`;
  if (digits.startsWith('254')) return `+${digits}`;
  return `+${digits}`;
}

export function normalizeRecipient(
  channel: AssistantChannel,
  recipient: string,
): string {
  return channel === 'EMAIL'
    ? recipient.trim().toLowerCase()
    : normalizePhone(recipient);
}

/**
 * Org-level outbound messaging for the assistant's communicate tools.
 *
 * Consent is enforced before send against the platform opt-out store
 * (`CommunicationConsent`); a matching OPTED_OUT record blocks the message.
 * Every send is recorded in `AssistantOutboundMessage` for audit. With no
 * provider key configured it runs in mock mode (like the admin bulk comms) so
 * staging and tests are safe.
 *
 * Known limitation (recorded in the Phase E note): a per-customer consent
 * store is a follow-up; recipients absent from `CommunicationConsent` are
 * treated as transactional and allowed.
 */
@Injectable()
export class AssistantCommsService {
  private readonly logger = new Logger(AssistantCommsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async assertConsent(
    organizationId: string,
    channel: AssistantChannel,
    recipient: string,
  ): Promise<void> {
    const normalized = normalizeRecipient(channel, recipient);
    const record = await this.prisma.db.communicationConsent.findFirst({
      where:
        channel === 'EMAIL' ? { email: normalized } : { phone: normalized },
      select: { emailStatus: true, smsStatus: true },
    });
    const status =
      channel === 'EMAIL' ? record?.emailStatus : record?.smsStatus;
    if (status === CommunicationOptOutStatus.OPTED_OUT) {
      throw new ForbiddenException(
        `This recipient has opted out of ${channel === 'EMAIL' ? 'email' : 'SMS'} messages.`,
      );
    }
  }

  async send(params: SendMessageParams): Promise<SendMessageResult> {
    const recipient = normalizeRecipient(params.channel, params.recipient);
    await this.assertConsent(params.organizationId, params.channel, recipient);

    let status: SendMessageResult['status'] = 'MOCKED';
    let errorMessage: string | undefined;

    try {
      if (params.channel === 'EMAIL') {
        const apiKey =
          this.config.get<string>('resend.apiKey') || process.env.RESEND_API_KEY;
        if (apiKey) {
          const from =
            process.env.RESEND_FROM_EMAIL || 'noreply@hisaflow.com';
          const resend = new Resend(apiKey);
          await resend.emails.send({
            from,
            to: recipient,
            subject: params.subject ?? 'Message from your business',
            html: params.message.replace(/\n/g, '<br>'),
          });
          status = 'SENT';
        }
      } else {
        const apiKey =
          process.env.AFRICAS_TALKING_API_KEY ||
          process.env.AFRICASTALKING_API_KEY;
        const username =
          this.config.get<string>('africasTalking.username') ||
          process.env.AFRICAS_TALKING_USERNAME ||
          'sandbox';
        if (apiKey) {
          const body = new URLSearchParams();
          body.append('username', username);
          body.append('to', recipient);
          body.append('message', params.message);
          const response = await fetch(
            'https://api.africastalking.com/version1/messaging',
            {
              method: 'POST',
              headers: {
                apiKey,
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: body.toString(),
            },
          );
          if (!response.ok) {
            throw new Error(`SMS provider returned ${response.status}`);
          }
          status = 'SENT';
        }
      }
    } catch (error) {
      status = 'FAILED';
      errorMessage =
        error instanceof Error ? error.message : 'Message could not be sent.';
      this.logger.warn(`Outbound ${params.channel} failed: ${errorMessage}`);
    }

    await this.prisma.db.assistantOutboundMessage.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        proposalId: params.proposalId ?? null,
        channel: params.channel,
        recipient,
        subject: params.subject ?? null,
        body: params.message,
        status,
        errorMessage: errorMessage ?? null,
      },
    });

    if (status === 'FAILED') {
      throw new BadRequestException(errorMessage ?? 'Message could not be sent.');
    }
    return { status, recipient };
  }
}
