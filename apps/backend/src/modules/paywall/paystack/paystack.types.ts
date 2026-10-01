/**
 * Minimal Paystack wire types used by the Phase A foundation.
 *
 * Paystack's webhook envelope is stable (`event` + `data`), but the shape of
 * `data` varies per event type, so `data` keeps an index signature rather than
 * pretending to model every event exhaustively. Handlers added in later phases
 * can narrow it per event as they need.
 */

export interface PaystackWebhookPayload {
  event: string;
  data: PaystackWebhookData;
}

export interface PaystackWebhookData {
  /** Charge/transaction id. Present on charge.* events. */
  id?: number | string;
  /** Unique transaction reference — the idempotency key for payments. */
  reference?: string;
  /** Present on subscription lifecycle events. */
  subscription_code?: string;
  /** Present on subscription/plan lifecycle events. */
  plan_code?: string;
  /** Present on subscription lifecycle events. */
  customer?: {
    id?: number;
    customer_code?: string;
    email?: string;
  };
  amount?: number;
  status?: string;
  /** 'card' | 'mobile_money' | ... — used to keep card and M-Pesa paths apart. */
  channel?: string;
  /** Present on charge/subscription events once recurring is set up. */
  subscription?: {
    subscription_code?: string;
    next_payment_date?: string;
    [key: string]: unknown;
  };
  /** Present on subscription/invoice events. */
  plan?: { plan_code?: string; interval?: string; [key: string]: unknown };
  /** Present on charge events; carries mobile-money details for M-Pesa. */
  authorization?: Record<string, unknown>;
  /** Echoed back by Paystack when supplied at checkout initialization. */
  metadata?: Record<string, unknown>;
  next_payment_date?: string;
  paid_at?: string;
  [key: string]: unknown;
}

export interface PaystackApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

export interface PaystackTransaction {
  id: number;
  reference: string;
  status: string;
  amount: number;
  currency: string;
  [key: string]: unknown;
}

/** A transaction row from `GET /transaction` (Phase E receipts). */
export interface PaystackTransactionListItem extends PaystackTransaction {
  created_at?: string;
  paid_at?: string;
  channel?: string;
  gateway_response?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** `GET /customer/:email_or_code` — used to resolve the numeric id the
 * transaction-list `customer` filter requires. */
export interface PaystackCustomer {
  id: number;
  customer_code: string;
  email?: string;
  [key: string]: unknown;
}

export interface PaystackPlan {
  id: number;
  name: string;
  plan_code: string;
  amount: number;
  interval: string;
  currency: string;
  [key: string]: unknown;
}

export interface CreatePaystackPlanInput {
  name: string;
  /** Amount in the smallest currency unit (KES cents). */
  amount: number;
  interval: 'monthly';
  description?: string;
}

/**
 * A Paystack Subscription object (Phase E). Paystack exposes create/list/fetch/
 * enable/disable only — there is no change-plan or proration endpoint. Moving
 * tiers is therefore disable-old + create-new (see `BillingService`).
 * `email_token` is required by the disable endpoint and is obtained by first
 * fetching the subscription.
 */
export interface PaystackSubscription {
  id: number;
  subscription_code: string;
  email_token?: string;
  status: string;
  amount?: number;
  next_payment_date?: string;
  customer?: { customer_code?: string; email?: string } | number;
  plan?: { plan_code?: string } | number;
  [key: string]: unknown;
}

export interface CreatePaystackSubscriptionInput {
  /** Customer email or customer code. */
  customer: string;
  /** Plan code to subscribe the customer to. */
  plan: string;
  /**
   * Card authorization code. Optional — when omitted Paystack uses the
   * customer's most recent authorization, which is what the upgrade path wants.
   */
  authorization?: string;
  /** ISO 8601 date for the first debit. Omitted means "start now". */
  start_date?: string;
}

export interface PaystackSubscriptionManageLink {
  link: string;
}

export interface ListPaystackTransactionsInput {
  /** Numeric Paystack customer id (not the CUS_ code). */
  customerId: number | string;
  perPage?: number;
  page?: number;
}

export interface PaystackInitializeResult {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface InitializeTransactionInput {
  email: string;
  /** Amount in the smallest currency unit (KES cents). */
  amount: number;
  /**
   * Card only: attaching the plan code creates the recurring Subscription.
   * Omitted for the M-Pesa first charge, which cannot use Paystack recurring.
   */
  plan?: string;
  reference: string;
  callback_url?: string;
  /** Card is `['card']`; the M-Pesa paywall flow is `['mobile_money']`. */
  channels?: string[];
  metadata?: Record<string, unknown>;
}

export interface ChargeMobileMoneyInput {
  email: string;
  /** Amount in the smallest currency unit (KES cents). */
  amount: number;
  currency: string;
  phone: string;
  /** Paystack mobile-money provider, for example 'mpesa'. */
  provider: string;
  reference: string;
  metadata?: Record<string, unknown>;
}

export interface PaystackChargeResult {
  /** 'pay_offline' | 'send_otp' | 'success' | 'failed' — the final outcome comes by webhook. */
  status: string;
  display_text?: string;
  reference?: string;
  [key: string]: unknown;
}

/**
 * Extract the Paystack reference an event should be idempotent on. Charge
 * events carry `data.reference`; subscription events carry a
 * `subscription_code`. Returns null when the payload has neither, in which
 * case the caller falls back to hashing the whole payload.
 */
export function extractPaystackReference(
  payload: PaystackWebhookPayload,
): string | null {
  const data = payload?.data ?? {};
  const candidates = [
    data.reference,
    data.subscription_code,
    data.plan_code,
    data.id != null ? String(data.id) : undefined,
  ];
  const found = candidates.find(
    (value): value is string =>
      typeof value === 'string' && value.length > 0,
  );
  return found ?? null;
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

/** `data.subscription_code` or the nested `data.subscription.subscription_code`. */
export function getSubscriptionCode(
  data: PaystackWebhookData,
): string | undefined {
  const nested = data.subscription;
  if (nested && typeof nested === 'object') {
    const code = asString(nested.subscription_code);
    if (code) return code;
  }
  return asString(data.subscription_code);
}

export function getCustomerCode(
  data: PaystackWebhookData,
): string | undefined {
  return asString(data.customer?.customer_code);
}

export function getCustomerEmail(
  data: PaystackWebhookData,
): string | undefined {
  return asString(data.customer?.email);
}

/** `data.plan_code` or the nested `data.plan.plan_code`. */
export function getPlanCode(
  data: PaystackWebhookData,
): string | undefined {
  const nested = data.plan;
  if (nested && typeof nested === 'object') {
    const code = asString(nested.plan_code);
    if (code) return code;
  }
  return asString(data.plan_code);
}

/** Organization id we stamped into transaction metadata at checkout. */
export function getOrganizationIdFromMetadata(
  data: PaystackWebhookData,
): string | undefined {
  const metadata = data.metadata;
  if (metadata && typeof metadata === 'object') {
    return asString(metadata.organizationId);
  }
  return undefined;
}

/**
 * M-Pesa number for the subscription, from the metadata we set at first
 * checkout (preferred) or from Paystack's authorization block on the charge.
 */
export function getMpesaPhone(
  data: PaystackWebhookData,
): string | undefined {
  const metadata = data.metadata;
  if (metadata && typeof metadata === 'object') {
    const fromMetadata = asString(metadata.mpesaPhone);
    if (fromMetadata) return fromMetadata;
  }

  const authorization = data.authorization;
  if (authorization && typeof authorization === 'object') {
    return (
      asString(authorization.mobile_money_number) ??
      asString(authorization.receiver_bank_account_number) ??
      asString(authorization.sender_bank_account_number)
    );
  }
  return undefined;
}

/**
 * Next renewal date Paystack reports, if present. Falls back to undefined so
 * callers can apply their own +1-month default.
 */
export function getNextPaymentDate(
  data: PaystackWebhookData,
): Date | undefined {
  const nested = data.subscription;
  const raw =
    (nested && typeof nested === 'object'
      ? asString(nested.next_payment_date)
      : undefined) ?? asString(data.next_payment_date);
  if (!raw) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
