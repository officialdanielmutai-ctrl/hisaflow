'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  ShieldAlert,
  Search,
  Lock,
  ArrowRight,
  Clock,
  User,
  Building2,
  CheckCircle2,
  X,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { adminFetch } from '@/lib/api-client';
import { MessageAccessLogEntry, OrganizationListItem } from '@/lib/types';

const ACCESS_REASONS = [
  'Support ticket',
  'Abuse investigation',
  'Billing dispute',
  'Account verification',
  'Compliance review',
  'Other (specify)',
];

export default function MessagesHubPage() {
  const router = useRouter();

  // Search orgs to access
  const [orgSearch, setOrgSearch] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<OrganizationListItem | null>(null);

  // Access Reason Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [reasonCategory, setReasonCategory] = useState(ACCESS_REASONS[0]);
  const [reasonNote, setReasonNote] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Fetch access logs
  const { data: logsData, mutate: mutateLogs } = useSWR<MessageAccessLogEntry[]>(
    '/admin/messages/access-logs',
    (url: string) => adminFetch(url),
  );

  // Fetch search results when user types
  const { data: searchResults } = useSWR<{ items: OrganizationListItem[] }>(
    orgSearch.trim().length >= 2 ? `/admin/accounts?search=${encodeURIComponent(orgSearch)}&limit=5` : null,
    (url: string) => adminFetch(url),
  );

  const logs = logsData || [];
  const searchItems = searchResults?.items || [];

  const handleOpenReasonModal = (org: OrganizationListItem) => {
    setSelectedOrg(org);
    setReasonCategory(ACCESS_REASONS[0]);
    setReasonNote('');
    setRequestError(null);
    setModalOpen(true);
  };

  const handleConfirmAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg) return;

    if (reasonCategory === 'Other (specify)' && !reasonNote.trim()) {
      setRequestError('Please provide a specific explanation when selecting "Other".');
      return;
    }

    try {
      setRequestLoading(true);
      setRequestError(null);

      const res = await adminFetch<{ accessToken: string; expiresInSeconds: number }>(
        '/admin/messages/access',
        {
          method: 'POST',
          body: JSON.stringify({
            orgId: selectedOrg.id,
            reason: reasonCategory,
            reasonNote: reasonNote.trim() || undefined,
          }),
        },
      );

      // Store time-limited session token in sessionStorage
      sessionStorage.setItem(`msg_access_${selectedOrg.id}`, res.accessToken);
      sessionStorage.setItem(`msg_reason_${selectedOrg.id}`, reasonCategory);

      setModalOpen(false);
      mutateLogs();
      router.push(`/messages/${selectedOrg.id}`);
    } catch (err: any) {
      setRequestError(err.message || 'Failed to authorize observability session');
    } finally {
      setRequestLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-admin-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <MessageSquare className="w-5 h-5 text-brand-400" />
            Customer Conversation & Communication Observability
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Permissioned inspection of customer support inquiries, AI parsing proposals, and automated notification dispatches.
          </p>
        </div>
      </div>

      {/* Compliance Policy Notice */}
      <div className="p-4 rounded-xl bg-admin-900/60 border border-admin-800 flex items-start gap-3.5">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
          <ShieldAlert className="w-4 h-4" />
        </div>
        <div className="space-y-1 text-xs">
          <div className="font-semibold text-slate-200">Mandatory Reason Gating Invariant</div>
          <p className="text-slate-400 leading-relaxed">
            Customer communications are protected by privacy and compliance standards. To prevent silent surveillance,
            accessing any account's message history strictly requires submitting an official reason. Every access creates an
            immutable audit record and is visible to Super Admins.
          </p>
        </div>
      </div>

      {/* Search & Launch Access Section */}
      <div className="bg-admin-900/80 border border-admin-800 rounded-xl p-5 space-y-4">
        <h2 className="text-xs font-semibold text-white uppercase tracking-wider font-mono flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-brand-400" />
          Request Observability Access to Organization Communications
        </h2>

        <div className="relative max-w-xl">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Type organization name or phone number..."
            value={orgSearch}
            onChange={(e) => setOrgSearch(e.target.value)}
            className="w-full bg-admin-950 border border-admin-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
          />

          {searchItems.length > 0 && orgSearch.trim().length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-admin-900 border border-admin-800 rounded-xl shadow-2xl z-20 overflow-hidden divide-y divide-admin-800">
              {searchItems.map((org) => (
                <div
                  key={org.id}
                  onClick={() => handleOpenReasonModal(org)}
                  className="p-3 flex items-center justify-between hover:bg-admin-800 cursor-pointer transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-white">{org.name}</div>
                    <div className="text-[10px] font-mono text-slate-400">
                      ID: {org.id.slice(0, 14)}... • Type: {org.businessType} • {org._count.users} members
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] text-brand-400 font-medium">
                    Select <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recently Accessed Trail Table */}
      <div className="bg-admin-900/80 border border-admin-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-admin-800 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
            Recent Message Access Audit Trail
          </h2>
          <span className="text-[11px] text-slate-500 font-mono">
            Monitored by Compliance & Super Admins
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-admin-950/80 text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-admin-800">
              <tr>
                <th className="py-3 px-4">Admin Operator</th>
                <th className="py-3 px-4">Target Organization</th>
                <th className="py-3 px-4">Official Reason</th>
                <th className="py-3 px-4">Explanation Note</th>
                <th className="py-3 px-4 text-right">Accessed At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-800/60">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 font-mono text-xs">
                    No message history accesses recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-admin-850/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span>{log.adminName}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">ID: {log.adminId}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-brand-400" />
                        <span>{log.orgName}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">Org ID: {log.orgId.slice(0, 12)}...</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        {log.accessReason}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
                      {log.reasonNote || '—'}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-500">
                      {new Date(log.accessedAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mandatory Reason Gate Modal */}
      {modalOpen && selectedOrg && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-admin-900 border border-admin-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Observability Reason Required</h3>
                  <p className="text-xs text-slate-400">{selectedOrg.name}</p>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Viewing customer communication history requires a logged operational justification. A 30-minute time-limited
              session will be issued.
            </p>

            <form onSubmit={handleConfirmAccess} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Access Reason Taxonomy</label>
                <select
                  value={reasonCategory}
                  onChange={(e) => setReasonCategory(e.target.value)}
                  className="w-full bg-admin-950 border border-admin-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                >
                  {ACCESS_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  Ticket # / Case Justification Note
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Ticket #4820 - Customer reporting anomaly in AI inventory extraction receipt parsing..."
                  value={reasonNote}
                  onChange={(e) => setReasonNote(e.target.value)}
                  className="w-full bg-admin-950 border border-admin-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              {requestError && (
                <div className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20">
                  {requestError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-admin-800 hover:bg-admin-700 text-xs font-medium text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={requestLoading}
                  className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-xs font-bold text-white shadow-sm"
                >
                  {requestLoading ? 'Logging & Authorizing...' : 'Authorize & View Messages'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
