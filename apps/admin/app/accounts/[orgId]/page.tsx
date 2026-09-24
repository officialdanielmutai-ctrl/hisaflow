'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Building2,
  Users,
  ShieldAlert,
  ArrowLeft,
  Lock,
  Unlock,
  AlertTriangle,
  Clock,
  CheckCircle2,
  X,
  CreditCard,
  History,
  Mail,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { adminFetch } from '@/lib/api-client';
import { AccountDetailResponse, AdminAuditLogEntry } from '@/lib/types';

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  const { data, error, isLoading, mutate } = useSWR<AccountDetailResponse>(
    orgId ? `/admin/accounts/${orgId}` : null,
    (url: string) => adminFetch(url),
  );

  const { data: historyData, mutate: mutateHistory } = useSWR<AdminAuditLogEntry[]>(
    orgId ? `/admin/accounts/${orgId}/history` : null,
    (url: string) => adminFetch(url),
  );

  const [activeTab, setActiveTab] = useState<'users' | 'subscription' | 'history'>('users');
  const [freezeModalOpen, setFreezeModalOpen] = useState(false);
  const [unfreezeModalOpen, setUnfreezeModalOpen] = useState(false);
  const [reasonCategory, setReasonCategory] = useState('Abuse investigation');
  const [reasonNote, setReasonNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const org = data?.organization;
  const users = data?.users || [];
  const history = historyData || [];
  const isFrozen = org?.status === 'FROZEN';

  const handleFreeze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonNote.trim()) {
      setActionError('Please provide an explanation note for the freeze action.');
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);
      const fullReason = `${reasonCategory}: ${reasonNote.trim()}`;

      await adminFetch(`/admin/accounts/${orgId}/freeze`, {
        method: 'POST',
        body: JSON.stringify({ reason: fullReason }),
      });

      setFreezeModalOpen(false);
      setReasonNote('');
      mutate();
      mutateHistory();
    } catch (err: any) {
      setActionError(err.message || 'Failed to freeze account');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnfreeze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonNote.trim()) {
      setActionError('Please provide a reason explaining why the account is being restored.');
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);
      const fullReason = `Unfreeze: ${reasonNote.trim()}`;

      await adminFetch(`/admin/accounts/${orgId}/unfreeze`, {
        method: 'POST',
        body: JSON.stringify({ reason: fullReason }),
      });

      setUnfreezeModalOpen(false);
      setReasonNote('');
      mutate();
      mutateHistory();
    } catch (err: any) {
      setActionError(err.message || 'Failed to unfreeze account');
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-slate-500 font-mono text-xs">
        Loading organization account details...
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="py-12 space-y-4 text-center">
        <div className="text-rose-400 text-sm font-semibold">Failed to load organization account</div>
        <p className="text-xs text-slate-400">{error?.message || 'Organization not found'}</p>
        <Link
          href="/accounts"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-admin-800 text-xs text-slate-200"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Accounts
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-admin-800">
        <div className="flex items-center gap-3">
          <Link
            href="/accounts"
            className="p-1.5 rounded-lg border border-admin-800 text-slate-400 hover:text-white hover:bg-admin-850 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-white">{org.name}</h1>
              {isFrozen ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <Lock className="w-3.5 h-3.5" /> Frozen
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Active
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-slate-500 mt-0.5">
              ID: {org.id} • Type: <span className="uppercase text-slate-400">{org.businessType}</span> • Currency: {org.currency}
            </p>
          </div>
        </div>

        {/* Administrative Action Trigger */}
        <div className="flex items-center gap-3">
          {isFrozen ? (
            <button
              onClick={() => {
                setActionError(null);
                setReasonNote('');
                setUnfreezeModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Unlock className="w-3.5 h-3.5" /> Unfreeze Account
            </button>
          ) : (
            <button
              onClick={() => {
                setActionError(null);
                setReasonNote('');
                setFreezeModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Lock className="w-3.5 h-3.5" /> Freeze Account
            </button>
          )}
        </div>
      </div>

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-admin-900/60 border border-admin-800 rounded-xl p-3">
          <div className="text-[11px] text-slate-400 font-medium">Team Members</div>
          <div className="text-lg font-bold text-white mt-1">{users.length}</div>
        </div>
        <div className="bg-admin-900/60 border border-admin-800 rounded-xl p-3">
          <div className="text-[11px] text-slate-400 font-medium">Products / Stock</div>
          <div className="text-lg font-bold text-white mt-1">{org.counts.products}</div>
        </div>
        <div className="bg-admin-900/60 border border-admin-800 rounded-xl p-3">
          <div className="text-[11px] text-slate-400 font-medium">ISP Subscribers</div>
          <div className="text-lg font-bold text-white mt-1">{org.counts.subscribers}</div>
        </div>
        <div className="bg-admin-900/60 border border-admin-800 rounded-xl p-3">
          <div className="text-[11px] text-slate-400 font-medium">Routers</div>
          <div className="text-lg font-bold text-white mt-1">{org.counts.routers}</div>
        </div>
        <div className="bg-admin-900/60 border border-admin-800 rounded-xl p-3">
          <div className="text-[11px] text-slate-400 font-medium">Unresolved Alerts</div>
          <div className="text-lg font-bold text-white mt-1">{org.counts.alerts}</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-admin-800 flex gap-6">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-xs font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'users'
              ? 'border-brand-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Members & Sessions ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('subscription')}
          className={`pb-3 text-xs font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'subscription'
              ? 'border-brand-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Subscription & Plan</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 text-xs font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'history'
              ? 'border-brand-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Audit History ({history.length})</span>
        </button>
      </div>

      {/* Tab 1: Users & Live Clerk Status */}
      {activeTab === 'users' && (
        <div className="bg-admin-900/80 border border-admin-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-admin-800 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
              Live Clerk Authentication Roster
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">
              Queried directly from Clerk Backend API
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-admin-950/80 text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-admin-800">
                <tr>
                  <th className="py-3 px-4">Member Name</th>
                  <th className="py-3 px-4">Org Role</th>
                  <th className="py-3 px-4">Clerk Status</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-800/60">
                {users.map((item) => (
                  <tr key={item.id} className="hover:bg-admin-850/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">
                        {item.user.name || 'Unnamed User'}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        {item.user.clerkId}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700">
                        {item.role}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {item.user.banned ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <Lock className="w-3 h-3" /> Banned
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Allowed
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-300">
                      {item.user.email || '—'}
                    </td>

                    <td className="py-3 px-4 text-slate-300 font-mono">
                      {item.user.phone || '—'}
                    </td>

                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {item.user.lastActiveAt
                        ? new Date(item.user.lastActiveAt).toLocaleString()
                        : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Subscription & Paywall */}
      {activeTab === 'subscription' && (
        <div className="bg-admin-900/80 border border-admin-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-admin-800">
            <div>
              <h2 className="text-sm font-bold text-white">Subscription Governance</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Current tier allocations and billing configuration.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded text-xs font-mono font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20">
              Active Tier: Standard
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-lg bg-admin-950 border border-admin-800 space-y-2">
              <span className="text-slate-400">Payment Reconciliation:</span>
              <p className="text-slate-200">
                Detailed payment transaction history and manual payment retry actions are being constructed in{' '}
                <Link href="/billing" className="text-brand-400 underline font-semibold">
                  Phase F (Paywall Module)
                </Link>
                .
              </p>
            </div>
            <div className="p-4 rounded-lg bg-admin-950 border border-admin-800 space-y-2">
              <span className="text-slate-400">Tenant Identifier:</span>
              <p className="font-mono text-slate-200">{org.id}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Audit History */}
      {activeTab === 'history' && (
        <div className="bg-admin-900/80 border border-admin-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-admin-800">
            <h2 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
              Administrative Action Log for this Organization
            </h2>
          </div>

          {history.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs font-mono">
              No administrative freeze/unfreeze actions recorded for this organization.
            </div>
          ) : (
            <div className="divide-y divide-admin-800/60 text-xs">
              {history.map((log) => (
                <div key={log.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{log.actionType}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-admin-800 text-slate-400">
                        by {log.admin.name} ({log.admin.email})
                      </span>
                    </div>
                    {log.reason && (
                      <p className="text-amber-300 text-xs bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded mt-1 inline-block">
                        Reason: {log.reason}
                      </p>
                    )}
                    {log.metadata && (
                      <div className="text-[10px] font-mono text-slate-500 mt-1">
                        Metadata: {JSON.stringify(log.metadata)}
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1 shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Freeze Account Modal */}
      {freezeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-admin-900 border border-admin-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Freeze Organization Account</h3>
                  <p className="text-xs text-slate-400">{org.name}</p>
                </div>
              </div>
              <button
                onClick={() => setFreezeModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 space-y-1">
              <div className="font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Immediate Effect Notice
              </div>
              <p>
                This action calls Clerk's <code>banUser</code> API on all {users.length} associated user accounts.
                All active sessions will be terminated immediately and logins rejected until unfrozen.
              </p>
            </div>

            <form onSubmit={handleFreeze} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Administrative Reason Category</label>
                <select
                  value={reasonCategory}
                  onChange={(e) => setReasonCategory(e.target.value)}
                  className="w-full bg-admin-950 border border-admin-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                >
                  <option value="Abuse investigation">Abuse investigation</option>
                  <option value="Non-payment / Billing breach">Non-payment / Billing breach</option>
                  <option value="Terms of service violation">Terms of service violation</option>
                  <option value="Suspicious security activity">Suspicious security activity</option>
                  <option value="Requested by organization owner">Requested by organization owner</option>
                  <option value="Compliance review">Compliance review</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  Mandatory Audit Explanation Note <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detail the justification for freezing this customer account..."
                  value={reasonNote}
                  onChange={(e) => setReasonNote(e.target.value)}
                  className="w-full bg-admin-950 border border-admin-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              {actionError && (
                <div className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20">
                  {actionError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setFreezeModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-admin-800 hover:bg-admin-700 text-xs font-medium text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-xs font-bold text-white shadow-sm"
                >
                  {actionLoading ? 'Freezing...' : 'Confirm Freeze'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unfreeze Account Modal */}
      {unfreezeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-admin-900 border border-admin-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Unlock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Unfreeze Organization Account</h3>
                  <p className="text-xs text-slate-400">{org.name}</p>
                </div>
              </div>
              <button
                onClick={() => setUnfreezeModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              This action calls Clerk's <code>unbanUser</code> API to restore normal authentication privileges for all {users.length} members.
            </p>

            <form onSubmit={handleUnfreeze} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  Mandatory Audit Explanation Note <span className="text-emerald-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain why this account is being unfrozen and restored..."
                  value={reasonNote}
                  onChange={(e) => setReasonNote(e.target.value)}
                  className="w-full bg-admin-950 border border-admin-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              {actionError && (
                <div className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20">
                  {actionError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setUnfreezeModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-admin-800 hover:bg-admin-700 text-xs font-medium text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white shadow-sm"
                >
                  {actionLoading ? 'Restoring...' : 'Confirm Unfreeze'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
