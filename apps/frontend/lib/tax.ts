/**
 * Pure helpers for the Phase A tax-registration screen. Dependency-free so the
 * "never present registration as further along than it is" rule can be tested
 * directly — the status copy is the contract, not the JSX.
 */

export type TaxStatus =
  | 'NOT_REGISTERED'
  | 'PIN_CAPTURED'
  | 'PENDING_KRA_APPROVAL'
  | 'SANDBOX_ACTIVE'
  | 'PENDING_PRODUCTION'
  | 'PRODUCTION_ACTIVE'
  | 'REJECTED'
  | 'SUSPENDED';

export type TaxStatusTone = 'neutral' | 'pending' | 'active' | 'danger';

export interface TaxStatusMeta {
  label: string;
  tone: TaxStatusTone;
  description: string;
}

const STATUS_META: Record<TaxStatus, TaxStatusMeta> = {
  NOT_REGISTERED: {
    label: 'Not registered',
    tone: 'neutral',
    description:
      'Enter your KRA PIN to start eTIMS registration. Nothing is filed until KRA approves your registration.',
  },
  PIN_CAPTURED: {
    label: 'PIN captured',
    tone: 'neutral',
    description:
      'Your KRA PIN is saved, but eTIMS registration has not been submitted yet.',
  },
  PENDING_KRA_APPROVAL: {
    label: 'Pending KRA approval',
    tone: 'pending',
    description:
      'KRA is reviewing your registration. This is a normal, expected wait — your device is not active yet.',
  },
  SANDBOX_ACTIVE: {
    label: 'Sandbox approved',
    tone: 'pending',
    description:
      'KRA approved your sandbox device. Sandbox testing comes next; production filing still needs KRA approval.',
  },
  PENDING_PRODUCTION: {
    label: 'Pending production approval',
    tone: 'pending',
    description:
      'Your production registration is with KRA. Live filing is not enabled until KRA approves it.',
  },
  PRODUCTION_ACTIVE: {
    label: 'Production active',
    tone: 'active',
    description: 'KRA approved production. Your eTIMS filing is live.',
  },
  REJECTED: {
    label: 'Rejected by KRA',
    tone: 'danger',
    description:
      'KRA rejected this registration. Correct the details and resubmit.',
  },
  SUSPENDED: {
    label: 'Suspended',
    tone: 'danger',
    description: 'KRA suspended this registration. Contact KRA support.',
  },
};

export function taxStatusMeta(status: TaxStatus): TaxStatusMeta {
  return (
    STATUS_META[status] ?? {
      label: status,
      tone: 'neutral',
      description: '',
    }
  );
}

/** Pending states must read as pending, never as active. */
export function isTaxPending(status: TaxStatus): boolean {
  return taxStatusMeta(status).tone === 'pending';
}

/** Live filing is allowed only in production. This is the single gate. */
export function canFileLive(status: TaxStatus): boolean {
  return status === 'PRODUCTION_ACTIVE';
}

/** The next step the org can act on — copy mirrors KRA's real sequence. */
export function nextTaxStep(status: TaxStatus): string {
  switch (status) {
    case 'NOT_REGISTERED':
      return 'Save your KRA PIN to begin.';
    case 'PIN_CAPTURED':
      return 'Submit your eTIMS Service Request and Commitment Form on the KRA portal, then record it here.';
    case 'PENDING_KRA_APPROVAL':
      return 'Wait for KRA to approve your sandbox device, then record the outcome.';
    case 'SANDBOX_ACTIVE':
      return 'Complete sandbox testing, then submit for production registration on the KRA portal.';
    case 'PENDING_PRODUCTION':
      return 'Wait for KRA to approve production, then record the outcome.';
    case 'PRODUCTION_ACTIVE':
      return 'No action needed — eTIMS filing is live.';
    case 'REJECTED':
      return 'Fix the details KRA flagged and resubmit.';
    case 'SUSPENDED':
      return 'Contact KRA support to resolve the suspension.';
    default:
      return '';
  }
}

/**
 * The KRA onboarding sequence, shown as a "what to expect" explainer so the
 * pending state is visibly normal rather than a dead end. KRA approval and the
 * Commitment Form happen outside HisaFlow — the copy says so.
 */
export const ETIMS_ONBOARDING_STEPS: { title: string; description: string }[] =
  [
    {
      title: 'Save your KRA PIN',
      description: 'So HisaFlow knows which taxpayer the registration belongs to.',
    },
    {
      title: 'Submit on the KRA portal',
      description:
        'Raise the eTIMS Service Request and upload the Commitment Form on KRA’s portal — this happens outside HisaFlow.',
    },
    {
      title: 'Wait for KRA approval',
      description:
        '“Pending KRA approval” is a normal, expected state and can take time. Nothing is filed yet.',
    },
    {
      title: 'Sandbox approved',
      description: 'KRA activates your sandbox device; testing happens next.',
    },
    {
      title: 'Production approved',
      description: 'Only after KRA certifies production does live filing switch on.',
    },
  ];

/**
 * What the screen may show/enable for a given registration. Pure so the
 * honesty rules (no submit before a PIN; no outcome before submission; no live
 * filing while pending; owner-only writes) are unit-tested, not just implied by
 * the JSX.
 */
export interface TaxScreenState {
  liveFiling: boolean;
  pending: boolean;
  showTimeline: boolean;
  canEditPin: boolean;
  canSubmit: boolean;
  canRecordOutcome: boolean;
}

export function taxScreenState(input: {
  status: TaxStatus;
  registered: boolean;
  submittedAt: string | null;
  isOwner: boolean;
}): TaxScreenState {
  const { status, registered, submittedAt, isOwner } = input;
  return {
    liveFiling: canFileLive(status),
    pending: isTaxPending(status),
    showTimeline: registered,
    canEditPin: isOwner,
    canSubmit:
      isOwner &&
      registered &&
      (status === 'PIN_CAPTURED' || status === 'REJECTED'),
    canRecordOutcome:
      isOwner && Boolean(submittedAt) && status !== 'PRODUCTION_ACTIVE',
  };
}
