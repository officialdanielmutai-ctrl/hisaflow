'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';
import { format } from 'date-fns';
import {
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Clock,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { useRole } from '@/hooks/useRole';
import {
  getTaxRegistration,
  recordKraOutcome,
  saveTaxRegistration,
  submitTaxRegistration,
  type EtimsIntegrationType,
  type TaxRegistrationStatus,
} from '@/services/tax.service';
import {
  canFileLive,
  ETIMS_ONBOARDING_STEPS,
  nextTaxStep,
  taxScreenState,
  taxStatusMeta,
  type TaxStatus,
  type TaxStatusTone,
} from '@/lib/tax';

const REPORTABLE_OUTCOMES: {
  value: TaxRegistrationStatus;
  label: string;
}[] = [
  { value: 'SANDBOX_ACTIVE', label: 'KRA approved my sandbox registration' },
  {
    value: 'PENDING_PRODUCTION',
    label: 'Submitted production registration to KRA',
  },
  { value: 'PRODUCTION_ACTIVE', label: 'KRA approved my production registration' },
  { value: 'REJECTED', label: 'KRA rejected my registration' },
  { value: 'SUSPENDED', label: 'KRA suspended my registration' },
];

const TONE_COLORS: Record<TaxStatusTone, string> = {
  active: 'var(--color-status-success)',
  pending: 'var(--color-status-warning)',
  danger: 'var(--color-status-critical)',
  neutral: 'var(--color-text-secondary)',
};

function toneStyle(tone: TaxStatusTone): React.CSSProperties {
  const color = TONE_COLORS[tone];
  return {
    color,
    backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
  };
}

export default function TaxSettingsPage() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const { isOwner } = useRole();
  const organizationId = membership?.organization?.id ?? null;

  const { data: registration, isLoading, error: loadError, mutate } = useSWR(
    organizationId ? ['tax-registration', organizationId] : null,
    async () => {
      const token = await getToken();
      if (!token) return null;
      return getTaxRegistration(token, organizationId as string);
    },
  );

  const [kraPin, setKraPin] = useState('');
  const [integrationType, setIntegrationType] =
    useState<EtimsIntegrationType>('VSCU');
  const [commitmentAck, setCommitmentAck] = useState(false);
  const [outcomeStatus, setOutcomeStatus] =
    useState<TaxRegistrationStatus>('SANDBOX_ACTIVE');
  const [outcomeNote, setOutcomeNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (registration?.kraPin) setKraPin(registration.kraPin);
    if (registration?.integrationType) {
      setIntegrationType(registration.integrationType);
    }
  }, [registration?.kraPin, registration?.integrationType]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setNotice(null);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  const handleSave = () =>
    run('save', async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await saveTaxRegistration(token, organizationId as string, {
        kraPin: kraPin.trim().toUpperCase(),
        integrationType,
      });
      setNotice('KRA PIN saved.');
      await mutate();
    });

  const handleSubmit = () =>
    run('submit', async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await submitTaxRegistration(token, organizationId as string, {
        commitmentFormAcknowledged: commitmentAck,
      });
      setNotice(
        'Recorded as submitted. KRA approval is a separate step outside HisaFlow — status stays pending until KRA responds.',
      );
      setCommitmentAck(false);
      await mutate();
    });

  const handleOutcome = () =>
    run('outcome', async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await recordKraOutcome(token, organizationId as string, {
        status: outcomeStatus,
        note: outcomeNote.trim(),
      });
      setNotice('KRA outcome recorded.');
      setOutcomeNote('');
      await mutate();
    });

  const status: TaxStatus = (registration?.status ?? 'NOT_REGISTERED') as TaxStatus;
  const meta = taxStatusMeta(status);
  const live = canFileLive(status);
  const screen = taxScreenState({
    status,
    registered: Boolean(registration?.registered),
    submittedAt: registration?.submittedAt ?? null,
    isOwner,
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-24">
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Settings
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Tax &amp; eTIMS
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Register your KRA PIN for eTIMS filing. KRA reviews registration on
          its side, so approval is a real step — HisaFlow shows exactly where
          you are and never treats a pending registration as active.
        </p>
      </div>

      {notice && (
        <div className="rounded-2xl border border-[var(--color-status-success)]/30 bg-[var(--color-status-success)]/10 p-4 text-sm text-[var(--color-status-success)]">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-[var(--color-status-critical)]/30 bg-[var(--color-status-critical)]/10 p-4 text-sm text-[var(--color-status-critical)]">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]" />
      ) : loadError ? (
        <section className="rounded-2xl border border-[var(--color-status-critical)]/30 bg-[var(--color-status-critical)]/10 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-status-critical)]">
            <CircleAlert className="h-4 w-4" />
            Couldn&apos;t load your eTIMS status
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            We don&apos;t know your registration status right now. Nothing on
            this screen should be treated as up to date until it loads.
          </p>
          <button
            type="button"
            onClick={() => mutate()}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[var(--color-accent)] px-4 text-sm font-semibold text-white"
          >
            Retry
          </button>
        </section>
      ) : (
        <>
          {/* ── Status ─────────────────────────────────────────────────── */}
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                  eTIMS registration status
                </p>
                <h2 className="mt-1 flex items-center gap-2 text-xl font-bold">
                  {meta.label}
                  {live ? (
                    <BadgeCheck className="h-5 w-5 text-[var(--color-status-success)]" />
                  ) : (
                    <Clock className="h-5 w-5 text-[var(--color-text-muted)]" />
                  )}
                </h2>
              </div>
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={toneStyle(meta.tone)}
              >
                {live ? 'Live filing on' : 'Live filing off'}
              </span>
            </div>

            <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
              {meta.description}
            </p>
            <p className="mt-2 text-sm font-medium text-[var(--color-text-primary)]">
              Next: {nextTaxStep(status)}
            </p>

            {registration?.integrationType === 'OSCU' && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--color-bg-base)] p-3 text-xs text-[var(--color-text-secondary)]">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-status-warning)]" />
                OSCU requires an always-online connection and is out of scope
                for HisaFlow. Re-register on the KRA portal with VSCU to use
                HisaFlow filing.
              </p>
            )}
          </section>

          {/* ── What to expect (KRA-side process) ─────────────────────── */}
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
            <h2 className="text-base font-semibold">
              How eTIMS registration works
            </h2>
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
              Approval happens on KRA&apos;s side, not in HisaFlow. Seeing
              &ldquo;Pending KRA approval&rdquo; is normal — it is neither a
              failure nor an activation.
            </p>
            <ol className="mt-4 space-y-3">
              {ETIMS_ONBOARDING_STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-3 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-base)] text-[11px] font-semibold text-[var(--color-text-muted)]">
                    {index + 1}
                  </span>
                  <span>
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {step.title}
                    </span>
                    <span className="mt-0.5 block text-[var(--color-text-secondary)]">
                      {step.description}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {/* ── KRA PIN ────────────────────────────────────────────────── */}
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck className="h-4 w-4" />
              KRA PIN
            </h2>
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
              This is your organisation&apos;s KRA PIN, used for eTIMS
              registration.
            </p>

            {!isOwner ? (
              <p className="mt-4 rounded-xl bg-[var(--color-bg-base)] p-3 text-sm text-[var(--color-text-secondary)]">
                {registration?.kraPin
                  ? `PIN on file: ${registration.kraPin}`
                  : 'No KRA PIN has been saved yet.'}{' '}
                Only the owner can change this.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="text-xs font-medium text-[var(--color-text-muted)]">
                      KRA PIN
                    </span>
                    <input
                      value={kraPin}
                      onChange={(e) => setKraPin(e.target.value.toUpperCase())}
                      placeholder="P051234567X"
                      className="mt-1 h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 text-sm uppercase outline-none focus:border-[var(--color-accent)]"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="text-xs font-medium text-[var(--color-text-muted)]">
                      Integration type
                    </span>
                    <select
                      value={integrationType}
                      onChange={(e) =>
                        setIntegrationType(e.target.value as EtimsIntegrationType)
                      }
                      className="mt-1 h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 text-sm outline-none focus:border-[var(--color-accent)]"
                    >
                      <option value="VSCU">VSCU (recommended — works offline)</option>
                      <option value="OSCU">OSCU (always online — unsupported)</option>
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  disabled={busy !== null || !/^[A-Za-z]\d{9}[A-Za-z]$/.test(kraPin.trim())}
                  onClick={handleSave}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save KRA PIN
                </button>
              </div>
            )}
          </section>

          {/* ── Submit to KRA ──────────────────────────────────────────── */}
          {screen.canSubmit && (
              <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
                <h2 className="text-base font-semibold">
                  Submit for KRA approval
                </h2>
                <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
                  Complete the eTIMS Service Request and upload the Commitment
                  Form on the KRA taxpayer portal, then record it here. KRA will
                  approve or reject it separately.
                </p>
                <label className="mt-4 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={commitmentAck}
                    onChange={(e) => setCommitmentAck(e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    I have submitted the eTIMS Service Request and Commitment
                    Form on the KRA portal.
                  </span>
                </label>
                <button
                  type="button"
                  disabled={busy !== null || !commitmentAck}
                  onClick={handleSubmit}
                  className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Mark as submitted to KRA
                </button>
              </section>
            )}

          {/* ── Record KRA outcome ─────────────────────────────────────── */}
          {screen.canRecordOutcome && (
              <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
                <h2 className="text-base font-semibold">Record KRA&apos;s response</h2>
                <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
                  When KRA responds on its portal, record the outcome here. This
                  is a record of what KRA said, not an activation by HisaFlow.
                </p>
                <div className="mt-4 space-y-3">
                  <select
                    value={outcomeStatus}
                    onChange={(e) =>
                      setOutcomeStatus(e.target.value as TaxRegistrationStatus)
                    }
                    className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 text-sm outline-none focus:border-[var(--color-accent)]"
                  >
                    {REPORTABLE_OUTCOMES.map((outcome) => (
                      <option key={outcome.value} value={outcome.value}>
                        {outcome.label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={outcomeNote}
                    onChange={(e) => setOutcomeNote(e.target.value)}
                    rows={2}
                    placeholder="Reference or note from KRA (required)"
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                  />
                  <button
                    type="button"
                    disabled={busy !== null || outcomeNote.trim().length < 3}
                    onClick={handleOutcome}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {busy === 'outcome' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Record outcome
                  </button>
                </div>
              </section>
            )}

          {/* ── Timeline ───────────────────────────────────────────────── */}
          {screen.showTimeline && registration && (
            <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
              <h2 className="text-base font-semibold">Progress</h2>
              <ol className="mt-4 space-y-3 text-sm">
                <Milestone
                  label="KRA PIN captured"
                  done={registration.status !== 'PIN_CAPTURED'}
                  date={registration.statusUpdatedAt}
                />
                <Milestone
                  label="Submitted to KRA"
                  done={Boolean(registration.submittedAt)}
                  date={registration.submittedAt}
                />
                <Milestone
                  label="Sandbox approved by KRA"
                  done={Boolean(registration.kraApprovedAt)}
                  date={registration.kraApprovedAt}
                />
                <Milestone
                  label="Production registration submitted"
                  done={Boolean(registration.productionSubmittedAt)}
                  date={registration.productionSubmittedAt}
                />
                <Milestone
                  label="Production active (live filing)"
                  done={Boolean(registration.productionActivatedAt)}
                  date={registration.productionActivatedAt}
                />
              </ol>
              {registration.statusNote && (
                <p className="mt-4 rounded-xl bg-[var(--color-bg-base)] p-3 text-xs text-[var(--color-text-secondary)]">
                  Latest note: {registration.statusNote}
                </p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Milestone({
  label,
  done,
  date,
}: {
  label: string;
  done: boolean;
  date: string | null;
}) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2">
        {done ? (
          <BadgeCheck className="h-4 w-4 text-[var(--color-status-success)]" />
        ) : (
          <Clock className="h-4 w-4 text-[var(--color-text-muted)]" />
        )}
        <span
          className={
            done
              ? 'text-[var(--color-text-primary)]'
              : 'text-[var(--color-text-muted)]'
          }
        >
          {label}
        </span>
      </span>
      <span className="text-xs text-[var(--color-text-muted)]">
        {done && date ? format(new Date(date), 'd MMM yyyy') : 'Pending'}
      </span>
    </li>
  );
}
