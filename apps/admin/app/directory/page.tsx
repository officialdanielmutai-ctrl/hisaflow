'use client';

import { useState, useCallback, useRef } from 'react';
import useSWR from 'swr';
import { AdminShell } from '../../components/admin-shell';
import { adminFetch } from '../../lib/api-client';
import {
  Users,
  Search,
  Download,
  Mail,
  Phone,
  MessageSquare,
  ChevronRight,
  X,
  Check,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import type { DirectoryUser } from '../../lib/types';

// ── Fetcher ──────────────────────────────────────────────────────
const fetcher = (url: string) => adminFetch<{ users: DirectoryUser[]; total: number }>(url);

function ConsentBadge({ status, label }: { status: 'OPTED_IN' | 'OPTED_OUT'; label: string }) {
  return status === 'OPTED_IN' ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
      <Check size={11} /> {label}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
      <X size={11} /> {label} opt-out
    </span>
  );
}

// ── Drawer ───────────────────────────────────────────────────────
function UserDrawer({
  user,
  onClose,
  onConsentChange,
}: {
  user: DirectoryUser;
  onClose: () => void;
  onConsentChange: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function toggleConsent(field: 'emailStatus' | 'smsStatus') {
    setSaving(true);
    setError('');
    const next = user[field] === 'OPTED_IN' ? 'OPTED_OUT' : 'OPTED_IN';
    try {
      await adminFetch(`/admin/directory/users/${user.clerkId}/consent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: next }),
      });
      onConsentChange();
    } catch (e: any) {
      setError(e?.message || 'Failed to update consent');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            {user.imageUrl ? (
              <img src={user.imageUrl} alt={user.name} className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-600">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">{user.clerkId}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Contact */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Contact</h3>
            <div className="space-y-2">
              {user.email && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Mail size={14} className="text-gray-400" />
                  <a href={`mailto:${user.email}`} className="hover:underline">{user.email}</a>
                </div>
              )}
              {user.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Phone size={14} className="text-gray-400" />
                  <a href={`tel:${user.phone}`} className="hover:underline">{user.phone}</a>
                </div>
              )}
            </div>
          </section>

          {/* Organization */}
          {user.primaryOrg && (
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Organization</h3>
              <div className="rounded-lg border bg-gray-50 p-3 text-sm">
                <p className="font-medium text-gray-800">{user.primaryOrg.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {user.primaryOrg.businessType} · {user.primaryOrg.role}
                </p>
              </div>
            </section>
          )}

          {/* Account Status */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Account</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Status</p>
                {user.banned ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                    <AlertCircle size={11} /> Banned
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    <Check size={11} /> Active
                  </span>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Joined</p>
                <p className="font-medium">{new Date(user.createdAt).toLocaleDateString()}</p>
              </div>
              {user.lastActiveAt && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-400 mb-0.5">Last Active</p>
                  <p className="font-medium">{new Date(user.lastActiveAt).toLocaleString()}</p>
                </div>
              )}
            </div>
          </section>

          {/* Communication Consent */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Communication Consent
            </h3>
            {error && (
              <div className="mb-3 flex items-center gap-2 rounded bg-red-50 px-3 py-2 text-sm text-red-600">
                <AlertCircle size={14} /> {error}
              </div>
            )}
            <div className="space-y-3">
              {/* Email consent */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Mail size={15} className="text-gray-400" />
                  <div>
                    <p className="text-sm font-medium">Email Marketing</p>
                    <ConsentBadge status={user.emailStatus} label="Email" />
                  </div>
                </div>
                <button
                  disabled={saving}
                  onClick={() => toggleConsent('emailStatus')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    user.emailStatus === 'OPTED_IN' ? 'bg-indigo-600' : 'bg-gray-200'
                  } disabled:opacity-50`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      user.emailStatus === 'OPTED_IN' ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* SMS consent */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <MessageSquare size={15} className="text-gray-400" />
                  <div>
                    <p className="text-sm font-medium">SMS Marketing</p>
                    <ConsentBadge status={user.smsStatus} label="SMS" />
                  </div>
                </div>
                <button
                  disabled={saving}
                  onClick={() => toggleConsent('smsStatus')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    user.smsStatus === 'OPTED_IN' ? 'bg-indigo-600' : 'bg-gray-200'
                  } disabled:opacity-50`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      user.smsStatus === 'OPTED_IN' ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────
export default function DirectoryPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedUser, setSelectedUser] = useState<DirectoryUser | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const limit = 25;
  const url = `/admin/directory/users?search=${encodeURIComponent(debouncedSearch)}&limit=${limit}&offset=${page * limit}`;

  const { data, error, isLoading, mutate } = useSWR(url, fetcher, { keepPreviousData: true });

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0);
    }, 350);
  }, []);

  const handleExport = () => {
    const link = document.createElement('a');
    link.href = `/api/admin/directory/users/export?search=${encodeURIComponent(debouncedSearch)}`;
    link.download = 'hisaflow-users.csv';
    link.click();
  };

  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users size={24} className="text-indigo-600" />
              User &amp; Email Directory
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {total.toLocaleString()} registered users · live Clerk roster
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => mutate()}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or phone…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-4 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-sm text-gray-400">
              <RefreshCw size={16} className="mr-2 animate-spin" /> Loading users…
            </div>
          ) : error ? (
            <div className="flex h-48 items-center justify-center text-sm text-red-500">
              <AlertCircle size={16} className="mr-2" /> Failed to load users
            </div>
          ) : users.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-sm text-gray-400">
              <Users size={32} className="mb-2 opacity-30" />
              No users found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3 hidden md:table-cell">Organization</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Last Active</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Email</th>
                    <th className="px-4 py-3 hidden sm:table-cell">SMS</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((user) => (
                    <tr
                      key={user.clerkId}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedUser(user)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {user.imageUrl ? (
                            <img
                              src={user.imageUrl}
                              alt={user.name}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-600">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{user.name}</p>
                            <p className="text-xs text-gray-400 truncate max-w-[160px]">
                              {user.email || user.phone || user.clerkId.slice(0, 16) + '…'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {user.primaryOrg ? (
                          <div>
                            <p className="font-medium text-gray-800">{user.primaryOrg.name}</p>
                            <p className="text-xs text-gray-400">{user.primaryOrg.businessType}</p>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">
                        {user.lastActiveAt
                          ? new Date(user.lastActiveAt).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <ConsentBadge status={user.emailStatus} label="Email" />
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <ConsentBadge status={user.smsStatus} label="SMS" />
                      </td>
                      <td className="px-4 py-3">
                        {user.banned ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                            <AlertCircle size={10} /> Banned
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            <Check size={10} /> Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        <ChevronRight size={16} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total.toLocaleString()}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded border px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User detail drawer */}
      {selectedUser && (
        <UserDrawer
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onConsentChange={() => {
            mutate();
            setSelectedUser(null);
          }}
        />
      )}
    </AdminShell>
  );
}
