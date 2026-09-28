'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';
import { AdminShell } from '../../components/admin-shell';
import { adminFetch } from '../../lib/api-client';
import type { ImpersonationToken, ImpersonationHistoryResponse } from '../../lib/types';
import {
  Eye,
  ShieldAlert,
  ShieldOff,
  Clock,
  CheckCircle,
  XCircle,
  ExternalLink,
  Search,
  RefreshCw,
  AlertTriangle,
  Copy,
  Check,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────

function isExpired(token: ImpersonationToken) {
  return new Date(token.expiresAt) < new Date();
}

function isActive(token: ImpersonationToken) {
  return !token.revokedAt && !isExpired(token);
}

function StatusBadge({ token }: { token: ImpersonationToken }) {
  if (token.revokedAt)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <XCircle size={11} /> Revoked
      </span>
    );
  if (isExpired(token))
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        <Clock size={11} /> Expired
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
      <ShieldAlert size={11} /> Active
    </span>
  );
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Generate Modal ────────────────────────────────────────────────

interface GenerateModalProps {
  onClose: () => void;
  onSuccess: (token: ImpersonationToken) => void;
  getToken: () => Promise<string | null>;
}

function GenerateModal({ onClose, onSuccess, getToken }: GenerateModalProps) {
  const [targetOrgId, setTargetOrgId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 10) {
      setError('Reason must be at least 10 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const clerkToken = await getToken();
      const data: ImpersonationToken = await adminFetch('/admin/impersonation/generate', {
        method: 'POST',
        token: clerkToken || undefined,
        body: JSON.stringify({ targetOrgId: targetOrgId.trim(), reason: reason.trim() }),
      });
      onSuccess(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate token';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Eye size={20} className="text-amber-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Generate View-As Token</h2>
            <p className="text-xs text-gray-500">Read-only · 15-minute session</p>
          </div>
        </div>

        {/* Warning banner */}
        <div className="flex gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 mb-4 text-xs text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            This session is <strong>read-only</strong> and fully audited. Your identity and reason
            are permanently logged.
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Organization ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              placeholder="e.g. cm_abc123..."
              value={targetOrgId}
              onChange={(e) => setTargetOrgId(e.target.value)}
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              Copy from the Accounts table or from the customer URL
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
              rows={3}
              placeholder="e.g. Customer reported dashboard loading issue — support ticket #4521"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minLength={10}
            />
            <p className="text-xs text-gray-400 mt-1">{reason.length} chars (min 10)</p>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-700 rounded-xl px-4 py-2 text-sm hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-amber-500 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-amber-600 transition disabled:opacity-50"
            >
              {loading ? 'Generating…' : 'Generate Token'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Token Result Modal ────────────────────────────────────────────

interface TokenResultModalProps {
  token: ImpersonationToken;
  onClose: () => void;
}

function TokenResultModal({ token, onClose }: TokenResultModalProps) {
  const [copied, setCopied] = useState(false);

  const CUSTOMER_APP_URL =
    process.env.NEXT_PUBLIC_CUSTOMER_APP_URL || 'https://app.hisaflow.com';
  const deepLink = `${CUSTOMER_APP_URL}/view-as?token=${encodeURIComponent(token.token ?? '')}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(deepLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <CheckCircle size={20} className="text-green-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">View-As Token Ready</h2>
            <p className="text-xs text-gray-500">Expires {fmtTime(token.expiresAt)}</p>
          </div>
        </div>

        <div className="space-y-3 mb-5">
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Target Organization</p>
            <p className="text-sm font-semibold text-gray-800">{token.targetOrgName}</p>
            <p className="text-xs text-gray-400 font-mono">{token.targetOrgId}</p>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-700">
            Share this link only with the agent investigating this case. It expires in 15 minutes.
          </div>
        </div>

        <div className="space-y-3">
          <a
            href={deepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-amber-500 text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-amber-600 transition"
          >
            <ExternalLink size={15} /> Open View-As Session
          </a>

          <button
            onClick={copyLink}
            className="flex items-center justify-center gap-2 w-full border border-gray-200 text-gray-700 rounded-xl px-4 py-2.5 text-sm hover:bg-gray-50 transition"
          >
            {copied ? (
              <Check size={15} className="text-green-600" />
            ) : (
              <Copy size={15} />
            )}
            {copied ? 'Copied!' : 'Copy Deep Link'}
          </button>

          <button
            onClick={onClose}
            className="w-full text-gray-500 text-sm hover:text-gray-700 py-1 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────

export default function ImpersonationPage() {
  const { getToken } = useAuth();
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<ImpersonationToken | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [orgFilter, setOrgFilter] = useState('');
  const [page, setPage] = useState(1);

  const fetcher = useCallback(
    async (url: string) => {
      const token = await getToken();
      return adminFetch(url, { token: token || undefined });
    },
    [getToken],
  );

  // Active sessions — poll every 30s
  const { data: activeSessions, mutate: mutateActive } = useSWR<ImpersonationToken[]>(
    '/admin/impersonation/active',
    fetcher,
    { refreshInterval: 30000 },
  );

  // Paginated history
  const historyKey = `/admin/impersonation/history?page=${page}${orgFilter ? `&targetOrgId=${orgFilter}` : ''}`;
  const {
    data: history,
    mutate: mutateHistory,
    isLoading: historyLoading,
  } = useSWR<ImpersonationHistoryResponse>(historyKey, fetcher);

  const handleGenerated = (token: ImpersonationToken) => {
    setShowGenerateModal(false);
    setGeneratedToken(token);
    mutateActive();
    mutateHistory();
  };

  const handleRevoke = async (tokenId: string) => {
    if (!confirm('Revoke this impersonation session? This cannot be undone.')) return;
    setRevoking(tokenId);
    try {
      const clerkToken = await getToken();
      await adminFetch(`/admin/impersonation/${tokenId}/revoke`, {
        method: 'POST',
        token: clerkToken || undefined,
      });
      mutateActive();
      mutateHistory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to revoke';
      alert(msg);
    } finally {
      setRevoking(null);
    }
  };

  return (
    <AdminShell>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">View-As (Read-Only)</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Generate short-lived 15-minute sessions to view a customer account without making
            changes. Every session is fully audited.
          </p>
        </div>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="flex items-center gap-2 bg-amber-500 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-amber-600 transition shrink-0"
        >
          <Eye size={16} /> Generate View-As Token
        </button>
      </div>

      {/* Policy banner */}
      <div className="flex gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 mb-6">
        <ShieldAlert size={20} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-semibold mb-1">Strict Usage Policy</p>
          <ul className="list-disc list-inside space-y-0.5 text-xs">
            <li>
              Sessions are <strong>read-only</strong> — all mutation actions are disabled in the
              customer app
            </li>
            <li>
              Every token generation is permanently logged with admin identity + reason
            </li>
            <li>Tokens expire automatically after 15 minutes</li>
            <li>Only SUPER_ADMIN can revoke active sessions or view full history</li>
          </ul>
        </div>
      </div>

      {/* Active Sessions */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" />
            Active Sessions
          </h2>
          <button
            onClick={() => mutateActive()}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            <RefreshCw size={11} /> Refresh
          </button>
        </div>

        {!activeSessions || activeSessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 py-10 text-center text-gray-400 text-sm">
            <ShieldOff size={28} className="mx-auto mb-2 opacity-30" />
            No active impersonation sessions
          </div>
        ) : (
          <div className="space-y-3">
            {activeSessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-4 p-4 rounded-2xl border border-amber-200 bg-amber-50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {s.targetOrgName}
                    </p>
                    <StatusBadge token={s} />
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    By{' '}
                    <span className="font-medium text-gray-700">{s.adminName}</span> —{' '}
                    <span className="italic">&#34;{s.reason}&#34;</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Expires {fmtTime(s.expiresAt)}
                  </p>
                </div>
                <button
                  onClick={() => handleRevoke(s.id)}
                  disabled={revoking === s.id}
                  className="flex items-center gap-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition disabled:opacity-50"
                >
                  {revoking === s.id ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <ShieldOff size={12} />
                  )}
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* History Table */}
      <section>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-base font-semibold text-gray-800">Access History</h2>
          <div className="relative">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Filter by Org ID…"
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 w-52"
              value={orgFilter}
              onChange={(e) => {
                setOrgFilter(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                  Organization
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Admin</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 hidden md:table-cell">
                  Reason
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 hidden lg:table-cell">
                  Created
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 hidden lg:table-cell">
                  Expires
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {historyLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 text-xs">
                    Loading history…
                  </td>
                </tr>
              ) : !history || history.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 text-xs">
                    No impersonation history found
                  </td>
                </tr>
              ) : (
                history.data.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 text-xs">{t.targetOrgName}</p>
                      <p className="text-gray-400 text-xs font-mono truncate max-w-[120px]">
                        {t.targetOrgId}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">{t.adminName}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-xs text-gray-500 italic max-w-[200px] truncate">
                        &#34;{t.reason}&#34;
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell">
                      {fmtTime(t.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell">
                      {fmtTime(t.expiresAt)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge token={t} />
                    </td>
                    <td className="px-4 py-3">
                      {isActive(t) && (
                        <button
                          onClick={() => handleRevoke(t.id)}
                          disabled={revoking === t.id}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {history && history.total > 50 && (
          <div className="flex justify-between items-center mt-4 text-xs text-gray-500">
            <span>{history.total} total records</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page * 50 >= history.total}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Modals */}
      {showGenerateModal && (
        <GenerateModal
          getToken={async () => getToken()}
          onClose={() => setShowGenerateModal(false)}
          onSuccess={handleGenerated}
        />
      )}
      {generatedToken && (
        <TokenResultModal
          token={generatedToken}
          onClose={() => setGeneratedToken(null)}
        />
      )}
    </AdminShell>
  );
}
