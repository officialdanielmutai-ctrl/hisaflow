import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  ChargeMobileMoneyInput,
  CreatePaystackPlanInput,
  CreatePaystackSubscriptionInput,
  InitializeTransactionInput,
  ListPaystackTransactionsInput,
  PaystackApiResponse,
  PaystackChargeResult,
  PaystackCustomer,
  PaystackInitializeResult,
  PaystackPlan,
  PaystackSubscription,
  PaystackSubscriptionManageLink,
  PaystackTransaction,
  PaystackTransactionListItem,
} from './paystack.types';

/**
 * Thin Paystack integration client for the HisaFlow paywall.
 *
 * Phase A only requires webhook signature verification plus a verified way to
 * look a transaction up server-side. Plan/subscription/charge helpers are added
 * by Phases B–E on top of the same `request()` primitive.
 */
@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private static readonly REQUEST_TIMEOUT_MS = 15_000;

  constructor(private readonly configService: ConfigService) {}

  private get secretKey(): string {
    return (
      this.configService.get<string>('paystack.secretKey') ||
      process.env.PAYSTACK_SECRET_KEY ||
      ''
    );
  }

  private get baseUrl(): string {
    return (
      this.configService.get<string>('paystack.baseUrl') ||
      'https://api.paystack.co'
    );
  }

  /**
   * Verify Paystack's webhook signature exactly as specified in Section 3.4:
   * HMAC-SHA512 over the RAW request body, keyed with the secret key, compared
   * to the `x-paystack-signature` header using a timing-safe comparison.
   *
   * Returns false (never throws) for any missing/tampered input, including a
   * missing secret key — failing closed is the only safe behavior here.
   */
  verifyWebhookSignature(
    rawBody: Buffer | string | undefined | null,
    signature: string | undefined | null,
  ): boolean {
    if (!rawBody || !signature) {
      return false;
    }

    const secret = this.secretKey;
    if (!secret) {
      this.logger.error(
        'PAYSTACK_SECRET_KEY is not configured — rejecting webhook rather than trusting an unverifiable signature',
      );
      return false;
    }

    const expected = crypto
      .createHmac('sha512', secret)
      .update(rawBody)
      .digest();

    // The header is hex-encoded. Decoding invalid/odd-length hex yields a
    // shorter (or empty) buffer; the length guard below rejects that without
    // letting timingSafeEqual throw.
    const received = Buffer.from(signature, 'hex');

    if (received.length !== expected.length) {
      return false;
    }

    return crypto.timingSafeEqual(expected, received);
  }

  /**
   * Server-side confirmation that a transaction reference was actually paid.
   * Useful for reconciliation and for the "I paid but I'm locked out" path —
   * never trust a client-reported reference.
   */
  async verifyTransaction(
    reference: string,
  ): Promise<PaystackApiResponse<PaystackTransaction>> {
    return this.request<PaystackTransaction>(
      'GET',
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );
  }

  /**
   * Create a Paystack Plan. One is created per priced HisaflowPlan tier
   * (Phase B) on a monthly interval, in KES. Idempotency across restarts is
   * handled by the caller caching `plan_code`; `HisaflowPlansService` also
   * checks `listPlans()` before creating to avoid duplicate Plan objects.
   */
  async createPlan(
    input: CreatePaystackPlanInput,
  ): Promise<PaystackApiResponse<PaystackPlan>> {
    return this.request<PaystackPlan>('POST', '/plan', input);
  }

  async listPlans(): Promise<PaystackApiResponse<PaystackPlan[]>> {
    return this.request<PaystackPlan[]>('GET', '/plan');
  }

  /**
   * Standard Paystack checkout initialization. Attaching the `plan` code makes
   * this single call both charge the first cycle and create the recurring
   * card Subscription (Section 3.1) — which is why card auto-renewal needs no
   * orchestration from HisaFlow afterward.
   */
  async initializeTransaction(
    input: InitializeTransactionInput,
  ): Promise<PaystackApiResponse<PaystackInitializeResult>> {
    return this.request<PaystackInitializeResult>(
      'POST',
      '/transaction/initialize',
      input,
    );
  }

  /**
   * Trigger a mobile-money charge (STK-via-Paystack). Paystack responds with
   * `pay_offline`/`send_otp` while the customer approves on their phone — the
   * authoritative outcome arrives later by webhook (`charge.success` /
   * `charge.failed`). Phase C's scheduled job is the only caller.
   */
  async chargeMobileMoney(
    input: ChargeMobileMoneyInput,
  ): Promise<PaystackApiResponse<PaystackChargeResult>> {
    return this.request<PaystackChargeResult>('POST', '/charge', {
      email: input.email,
      amount: input.amount,
      currency: input.currency,
      mobile_money: {
        phone: input.phone,
        provider: input.provider,
      },
      reference: input.reference,
      metadata: input.metadata,
    });
  }

  /**
   * Create a Subscription directly (Phase E upgrade / deferred downgrade).
   * Used when HisaFlow must move an existing customer to a different plan —
   * Paystack has no change-plan endpoint, so this is the "create new" half of
   * disable-old/create-new.
   */
  async createSubscription(
    input: CreatePaystackSubscriptionInput,
  ): Promise<PaystackApiResponse<PaystackSubscription>> {
    return this.request<PaystackSubscription>('POST', '/subscription', input);
  }

  /** Fetch a Subscription — also the source of the `email_token`. */
  async fetchSubscription(
    code: string,
  ): Promise<PaystackApiResponse<PaystackSubscription>> {
    return this.request<PaystackSubscription>(
      'GET',
      `/subscription/${encodeURIComponent(code)}`,
    );
  }

  /**
   * Disable (cancel) a Subscription. Paystack requires the subscription's
   * `email_token`, which is not part of the create webhook we store, so it is
   * fetched first. This is the "disable old" half of a tier change.
   */
  async disableSubscription(
    code: string,
  ): Promise<PaystackApiResponse<unknown>> {
    const fetched = await this.fetchSubscription(code);
    const token = fetched.data?.email_token;
    if (!token) {
      throw new Error(
        `Paystack subscription ${code} has no email_token — cannot disable it`,
      );
    }
    return this.request<unknown>('POST', '/subscription/disable', {
      code,
      token,
    });
  }

  /**
   * A hosted link the customer can use to update the card on an existing
   * subscription (Phase E payment-method change).
   */
  async generateUpdateSubscriptionLink(
    code: string,
  ): Promise<PaystackApiResponse<PaystackSubscriptionManageLink>> {
    return this.request<PaystackSubscriptionManageLink>(
      'GET',
      `/subscription/${encodeURIComponent(code)}/manage/link`,
    );
  }

  /**
   * Fetch a customer by email or `CUS_` code. Phase E needs this because the
   * transaction-list `customer` filter requires the numeric customer id, and we
   * only store the code.
   */
  async fetchCustomer(
    emailOrCode: string,
  ): Promise<PaystackApiResponse<PaystackCustomer>> {
    return this.request<PaystackCustomer>(
      'GET',
      `/customer/${encodeURIComponent(emailOrCode)}`,
    );
  }

  /**
   * The org's transactions — the receipt/invoice history Phase E surfaces.
   * Filtered by numeric customer id per Paystack's documented query params.
   */
  async listTransactions(
    input: ListPaystackTransactionsInput,
  ): Promise<PaystackApiResponse<PaystackTransactionListItem[]>> {
    const params = new URLSearchParams({
      customer: String(input.customerId),
      perPage: String(input.perPage ?? 50),
      page: String(input.page ?? 1),
    });
    return this.request<PaystackTransactionListItem[]>(
      'GET',
      `/transaction?${params.toString()}`,
    );
  }

  /**
   * Shared authenticated request primitive. Later phases (Plan creation,
   * Subscription enable/disable, Charge) build on this instead of each
   * re-implementing auth/error handling.
   */
  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<PaystackApiResponse<T>> {
    const secret = this.secretKey;
    if (!secret) {
      throw new Error('PAYSTACK_SECRET_KEY is not configured');
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(PaystackService.REQUEST_TIMEOUT_MS),
    });

    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(
        `Paystack returned a non-JSON response (${response.status}): ${text.slice(0, 200)}`,
      );
    }

    if (!response.ok) {
      const message =
        typeof parsed === 'object' && parsed !== null && 'message' in parsed
          ? String((parsed as { message: unknown }).message)
          : `HTTP ${response.status}`;
      throw new Error(`Paystack API error on ${method} ${path}: ${message}`);
    }

    return parsed as PaystackApiResponse<T>;
  }
}
