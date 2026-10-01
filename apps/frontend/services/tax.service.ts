import { apiGet, apiPost, apiPut } from '@/lib/api-client';

export type EtimsIntegrationType = 'VSCU' | 'OSCU';
export type EtimsEnvironment = 'SANDBOX' | 'PRODUCTION';
export type TaxRegistrationStatus =
  | 'NOT_REGISTERED'
  | 'PIN_CAPTURED'
  | 'PENDING_KRA_APPROVAL'
  | 'SANDBOX_ACTIVE'
  | 'PENDING_PRODUCTION'
  | 'PRODUCTION_ACTIVE'
  | 'REJECTED'
  | 'SUSPENDED';

export interface TaxRegistrationView {
  registered: boolean;
  kraPin: string | null;
  integrationType: EtimsIntegrationType | null;
  status: TaxRegistrationStatus;
  environment: EtimsEnvironment | null;
  canFileLive: boolean;
  commitmentFormAcknowledgedAt: string | null;
  submittedAt: string | null;
  kraApprovedAt: string | null;
  productionSubmittedAt: string | null;
  productionActivatedAt: string | null;
  statusNote: string | null;
  statusUpdatedAt: string | null;
}

export function getTaxRegistration(
  token: string,
  organizationId: string,
): Promise<TaxRegistrationView> {
  return apiGet<TaxRegistrationView>(
    '/tax/registration',
    token,
    organizationId,
  );
}

export function saveTaxRegistration(
  token: string,
  organizationId: string,
  input: { kraPin: string; integrationType?: EtimsIntegrationType },
): Promise<TaxRegistrationView> {
  return apiPut<TaxRegistrationView>(
    '/tax/registration',
    token,
    organizationId,
    input,
  );
}

export function submitTaxRegistration(
  token: string,
  organizationId: string,
  input: { commitmentFormAcknowledged: boolean },
): Promise<TaxRegistrationView> {
  return apiPost<TaxRegistrationView>(
    '/tax/registration/submit',
    token,
    organizationId,
    input,
  );
}

export function recordKraOutcome(
  token: string,
  organizationId: string,
  input: { status: TaxRegistrationStatus; note: string },
): Promise<TaxRegistrationView> {
  return apiPost<TaxRegistrationView>(
    '/tax/registration/kra-outcome',
    token,
    organizationId,
    input,
  );
}

// ── Phase D — read-only Tax tab ───────────────────────────────────────────

export type TaxFilingStatus = 'PENDING' | 'SYNCED' | 'FAILED';
export type TaxSyncErrorClass =
  | 'NETWORK_OFFLINE'
  | 'KRA_ERROR'
  | 'LOCAL_VSCU_ERROR';

export interface TaxReportInvoice {
  invoiceId: string;
  invoiceStatus: string;
  currency: string;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
  taxRate: number;
  status: TaxFilingStatus;
  signed: boolean;
  signedAt: string | null;
  syncedAt: string | null;
  kraInvoiceNumber: string | null;
  vscuReceiptNumber: string | null;
  syncStatus: TaxFilingStatus | null;
  attempts: number;
  kraErrorCount: number;
  nextAttemptAt: string | null;
  lastError: string | null;
  lastErrorClass: TaxSyncErrorClass | null;
  createdAt: string;
}

export interface TaxReportSummary {
  filed: number;
  pending: number;
  failed: number;
  taxableAmount: number;
  taxAmount: number;
  grossAmount: number;
  pendingTaxAmount: number;
}

export interface TaxReportView {
  registration: { status: TaxRegistrationStatus; canFileLive: boolean } | null;
  period: { from: string; to: string; label: string };
  summary: TaxReportSummary;
  invoices: TaxReportInvoice[];
  generatedAt: string;
}

/**
 * Read-only report for the Tax tab. There is deliberately no write counterpart
 * in this service for the tab — see `lib/tax-report.test.ts`'s guard.
 */
export function getTaxReport(
  token: string,
  organizationId: string,
  range?: { from?: string; to?: string },
): Promise<TaxReportView> {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  const query = params.toString();
  return apiGet<TaxReportView>(
    `/tax/report${query ? `?${query}` : ''}`,
    token,
    organizationId,
  );
}

// ── Phase E — reconciliation (Team-tier depth) ────────────────────────────

export type TaxAnomalyType =
  | 'SALE_NOT_FILED'
  | 'SALE_NOT_SYNCED'
  | 'FILED_AMOUNT_MISMATCH'
  | 'FILED_FOR_NON_SALE';

export interface TaxAnomaly {
  key: string;
  type: TaxAnomalyType;
  invoiceId: string;
  severity: 'warning' | 'critical';
  message: string;
  expectedTaxAmount: number | null;
  filedTaxAmount: number | null;
}

export interface TaxReconciliationView {
  period: { from: string; to: string; label: string };
  filingDeadline: string;
  /** Negative means the deadline has passed. */
  daysUntilDeadline: number;
  checkedInvoices: number;
  anomalies: TaxAnomaly[];
  generatedAt: string;
}

/**
 * Team-tier reconciliation data. A Solo org gets a 403 FeatureLocked from the
 * backend, which `api-client` turns into a paywall redirect — the gating is
 * enforced server-side, not merely hidden here.
 */
export function getTaxReconciliation(
  token: string,
  organizationId: string,
  range?: { from?: string; to?: string },
): Promise<TaxReconciliationView> {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  const query = params.toString();
  return apiGet<TaxReconciliationView>(
    `/tax/reconciliation${query ? `?${query}` : ''}`,
    token,
    organizationId,
  );
}

// ── Phase F — multi-location aggregation (Growth multi-location) ──────────

export interface TaxLocationSummary {
  location: string;
  invoiceCount: number;
  filed: number;
  pending: number;
  failed: number;
  taxableAmount: number;
  taxAmount: number;
  grossAmount: number;
  pendingTaxAmount: number;
}

export interface TaxAggregateView {
  period: { from: string; to: string; label: string };
  filingDeadline: string;
  /** Negative means the deadline has passed. */
  daysUntilDeadline: number;
  locationCount: number;
  locations: TaxLocationSummary[];
  totals: TaxLocationSummary;
  generatedAt: string;
}

/**
 * Growth-gated aggregated tax view. Reuses the existing multi-location
 * capability (the same gate the ISP vertical's second router uses); a Solo/Team
 * org gets a 403 FeatureLocked which `api-client` turns into a paywall redirect.
 */
export function getTaxAggregate(
  token: string,
  organizationId: string,
  range?: { from?: string; to?: string },
): Promise<TaxAggregateView> {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  const query = params.toString();
  return apiGet<TaxAggregateView>(
    `/tax/aggregate${query ? `?${query}` : ''}`,
    token,
    organizationId,
  );
}
