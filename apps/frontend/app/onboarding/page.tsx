'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { apiPost } from '@/lib/api-client';
import { joinOrganization } from '@/services/organizations.service';
import { Building2, Users } from 'lucide-react';

type Path = 'choose' | 'new' | 'join';

const BUSINESS_TYPES = [
  { value: 'DUKA',       label: 'Duka' },
  { value: 'MINI_MART',  label: 'Mini Mart' },
  { value: 'CHEMIST',    label: 'Chemist' },
  { value: 'RESTAURANT', label: 'Restaurant' },
  { value: 'SCHOOL',     label: 'School' },
  { value: 'WHOLESALER', label: 'Wholesaler' },
  { value: 'ISP',        label: 'Internet Service Provider (ISP)' },
];

export default function OnboardingPage() {
  const [path, setPath] = useState<Path>('choose');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('DUKA');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { getToken } = useAuth();
  const { membership, loading: orgLoading } = useMyOrganization();

  // Guard: if user already has an org, send them back to the app
  useEffect(() => {
    if (!orgLoading && membership) {
      window.location.href = '/';
    }
  }, [orgLoading, membership]);

  // ── Path A: Create new business ─────────────────────────────────────────────
  async function handleCreateBusiness(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await apiPost('/organizations', token, 'none', {
        name: businessName,
        businessType,
      });
      // Hard reload so useMyOrganization remounts and fetches the new membership
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create business');
    } finally {
      setLoading(false);
    }
  }

  // ── Path B: Join existing business ─────────────────────────────────────────
  async function handleJoinBusiness(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await joinOrganization(inviteCode.trim().toUpperCase(), token);
      // Hard reload so membership refetches
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid invite code');
    } finally {
      setLoading(false);
    }
  }

  // Show nothing while we check if the user already has an org
  if (orgLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg-base)]">
        <div className="flex flex-col gap-3 w-full max-w-sm px-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg-base)] p-4">
      <div className="w-full max-w-sm">

        {/* ── Step 0: Choose path ─────────────────────────────────────── */}
        {path === 'choose' && (
          <>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
              Welcome to Hisaflow
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)] mb-8">
              Are you setting up a new business or joining one that already exists?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setPath('new')}
                className="flex items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 text-left transition-colors hover:border-[var(--color-accent)]"
              >
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]/10">
                  <Building2 className="h-6 w-6 text-[var(--color-accent)]" />
                </span>
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">
                    Set up my business
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                    Create a new account — you'll be the owner
                  </p>
                </div>
              </button>

              <button
                onClick={() => setPath('join')}
                className="flex items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 text-left transition-colors hover:border-[var(--color-accent)]"
              >
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]/10">
                  <Users className="h-6 w-6 text-[var(--color-accent)]" />
                </span>
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">
                    Join a business
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                    Enter an invite code from your employer
                  </p>
                </div>
              </button>
            </div>
          </>
        )}

        {/* ── Step A: New business form ───────────────────────────────── */}
        {path === 'new' && (
          <>
            <button
              onClick={() => { setPath('choose'); setError(null); }}
              className="mb-6 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex items-center gap-1"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
              Set up your business
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
              Tell us about your business to get started.
            </p>
            <form onSubmit={handleCreateBusiness} className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium text-[var(--color-text-primary)] block mb-1">
                  Business name
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                  placeholder="e.g. Mama Njeri Duka"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--color-text-primary)] block mb-1">
                  Business type
                </label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                >
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={loading || !businessName.trim()}
                className="w-full rounded-xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[var(--color-accent-hover)] transition-colors"
              >
                {loading ? 'Setting up...' : 'Get started'}
              </button>
            </form>
          </>
        )}

        {/* ── Step B: Join with invite code ───────────────────────────── */}
        {path === 'join' && (
          <>
            <button
              onClick={() => { setPath('choose'); setError(null); }}
              className="mb-6 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex items-center gap-1"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
              Join a business
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
              Enter the 6-character invite code your employer shared with you.
            </p>
            <form onSubmit={handleJoinBusiness} className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium text-[var(--color-text-primary)] block mb-1">
                  Invite code
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  required
                  maxLength={6}
                  placeholder="e.g. AB3X7K"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3 text-sm font-mono tracking-widest text-[var(--color-text-primary)] uppercase focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={loading || inviteCode.length < 6}
                className="w-full rounded-xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[var(--color-accent-hover)] transition-colors"
              >
                {loading ? 'Joining...' : 'Join business'}
              </button>
            </form>
          </>
        )}

      </div>
    </main>
  );
}
