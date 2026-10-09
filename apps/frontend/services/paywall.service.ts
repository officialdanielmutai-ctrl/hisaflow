import { apiGet, apiPatch, apiPost } from '@/lib/api-client';
import { type HisaflowPlanTier } from '@/lib/plans';

export type { HisaflowPlanTier } from '@/lib/plans';
export { TIER_RANK } from '@/lib/plans';
export type BillingInterval = 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
export type SubscriptionStatus = 'ACTIVE' | 'GRACE' | 'SUSPENDED';
export type SubscriptionPaymentMethod = 'CARD' | 'MPESA';

export interface PaywallPlan {
  id: string;
  tier: HisaflowPlanTier;
  name: string;
  description: string | null;
  /** Prisma Decimal is serialized as a string over JSON. */
  priceKes: number | string;
  billingInterval: BillingInterval;
  seatAllowance: number;
  paystackPlanCode: string | null;
  isActive: boolean;
}

export interface OrgSubscription {
  id: string;
  status: SubscriptionStatus;
  paymentMethod: SubscriptionPaymentMethod;
  seatCount: number;
  seatAllowance: number;
  nextRenewalDate: string | null;
  graceEndsAt: string | null;
  trialEndsAt: string | null;
  paystackSubscriptionCode: string | null;
  /** Phase E: scheduled downgrade target, applied at the date below. */
  pendingTier: HisaflowPlanTier | null;
  pendingPlanEffectiveAt: string | null;
  plan: PaywallPlan;
}

// ── Phase E — billing management ─────────────────────────────────────────

export interface ChangePlanResult {
  mode: 'immediate' | 'scheduled';
  tier: HisaflowPlanTier;
  message: string;
  action?: 'checkout';
  method?: SubscriptionPaymentMethod;
  authorizationUrl?: string;
  reference?: string;
  amountKes?: number;
  effectiveAt?: string;
}

export interface SeatUpdateResult {
  seatCount: number;
  seatAllowance: number;
  additionalSeats: number;
  overageSeats: number;
  overageRateKes: number | null;
  autoBilled: boolean;
  message: string;
}

export interface PaymentMethodResult {
  action: 'update_card_link' | 'updated' | 'checkout';
  method: SubscriptionPaymentMethod;
  message: string;
  url?: string;
  authorizationUrl?: string;
  reference?: string;
}

export interface InvoiceRecord {
  id: string;
  reference: string | null;
  amountKes: number;
  method: SubscriptionPaymentMethod;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  planName: string | null;
  planTier: HisaflowPlanTier | null;
  attemptedAt: string;
  resolvedAt: string | null;
  errorMessage: string | null;
  /** 'paystack' = live from Paystack's Transactions list; 'local' = audit-trail fallback. */
  source: 'paystack' | 'local';
}

export interface CheckoutResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
  tier: HisaflowPlanTier;
  amountKes: number;
}

export interface StartCheckoutInput {
  tier: HisaflowPlanTier;
  callbackUrl?: string;
  email?: string;
}

export interface MpesaCheckoutInput extends StartCheckoutInput {
  mpesaPhone: string;
}

export function getPaywallPlans(
  token: string,
  organizationId: string,
): Promise<PaywallPlan[]> {
  return apiGet<PaywallPlan[]>('/paywall/plans', token, organizationId);
}

export function getSubscription(
  token: string,
  organizationId: string,
): Promise<OrgSubscription | null> {
  return apiGet<OrgSubscription | null>(
    '/paywall/subscription',
    token,
    organizationId,
  );
}

export function startCardCheckout(
  token: string,
  organizationId: string,
  input: StartCheckoutInput,
): Promise<CheckoutResult> {
  return apiPost<CheckoutResult>(
    '/paywall/checkout',
    token,
    organizationId,
    input,
  );
}

/**
 * First-cycle M-Pesa checkout. Goes through Paystack's checkout page (where the
 * customer selects M-Pesa and enters their number) before the STK prompt
 * appears — Section 3.3.
 */
export function startMpesaCheckout(
  token: string,
  organizationId: string,
  input: MpesaCheckoutInput,
): Promise<CheckoutResult> {
  return apiPost<CheckoutResult>(
    '/paywall/checkout/mpesa',
    token,
    organizationId,
    input,
  );
}

/**
 * Phase E: upgrade immediately (returns a checkout to redirect to) or schedule
 * a downgrade for the end of the current cycle.
 */
export function changePlan(
  token: string,
  organizationId: string,
  tier: HisaflowPlanTier,
): Promise<ChangePlanResult> {
  return apiPost<ChangePlanResult>(
    '/paywall/change-plan',
    token,
    organizationId,
    { tier },
  );
}

/** Phase E: add/remove purchased seats above the tier's included allowance. */
export function updateSeats(
  token: string,
  organizationId: string,
  additionalSeats: number,
): Promise<SeatUpdateResult> {
  return apiPatch<SeatUpdateResult>('/paywall/seats', token, organizationId, {
    additionalSeats,
  });
}

/** Phase E: update card / M-Pesa number, or switch rails. */
export function changePaymentMethod(
  token: string,
  organizationId: string,
  input: { method: SubscriptionPaymentMethod; mpesaPhone?: string },
): Promise<PaymentMethodResult> {
  return apiPost<PaymentMethodResult>(
    '/paywall/payment-method',
    token,
    organizationId,
    input,
  );
}

/** Phase E: receipt/invoice history for the org. */
export function getInvoices(
  token: string,
  organizationId: string,
): Promise<InvoiceRecord[]> {
  return apiGet<InvoiceRecord[]>(
    '/paywall/invoices',
    token,
    organizationId,
  );
}
