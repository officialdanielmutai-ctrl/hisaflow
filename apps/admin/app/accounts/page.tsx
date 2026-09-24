'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import {
  Building2,
  Search,
  Filter,
  Users,
  ShieldAlert,
  ArrowRight,
  Lock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Wifi,
  Package,
} from 'lucide-react';
import { adminFetch } from '@/lib/api-client';
import { OrganizationListItem } from '@/lib/types';

interface AccountsApiResponse {
  items: OrganizationListItem[];
  total: number;
  limit: number;
  offset: number;
}

const BUSINESS_TYPES = [
  { value: 'all', label: 'All Business Types' },
  { value: 'isp', label: 'ISP / Network' },
  { value: 'retail', label: 'Retail / Wholesale' },
  { value: 'chemist', label: 'Chemist / Pharmacy' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'school', label: 'School' },
  { value: 'guesthouse', label: 'Guest House' },
];

export default function AccountsListPage() {
  const [search, setSearch] = useState('');
  const [businessType, setBusinessType] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(0);
  const limit = 15;

  const { data, error, isLoading, mutate } = useSWR<AccountsApiResponse>(
    `/admin/accounts?search=${encodeURIComponent(search)}&businessType=${businessType}&status=${status}&limit=${limit}&offset=${
      page * limit
    }`,
    (url: string) => adminFetch(url),
    { keepPreviousData: true },
  );

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-admin-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-brand-400" />
            Organizations & Customer Accounts
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse, inspect, and administratively control customer organizations across all industry verticals.
          </p>
        </div>
        <div className="text-xs font-mono text-slate-400">
          Total Registered: <span className="text-white font-bold">{total}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-admin-900/60 border border-admin-800 p-3.5 rounded-xl">
        <div className="sm:col-span-6 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by org name, phone, or member email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="w-full bg-admin-950 border border-admin-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="sm:col-span-3">
          <select
            value={businessType}
            onChange={(e) => {
              setBusinessType(e.target.value);
              setPage(0);
            }}
            className="w-full bg-admin-950 border border-admin-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500"
          >
            {BUSINESS_TYPES.map((bt) => (
              <option key={bt.value} value={bt.value}>
                {bt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-3">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
            className="w-full bg-admin-950 border border-admin-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="frozen">Frozen Only (Locked)</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-admin-900/80 border border-admin-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-admin-950/80 text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-admin-800">
              <tr>
                <th className="py-3 px-4">Organization</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Team</th>
                <th className="py-3 px-4">Volume / Size</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-800/60">
              {isLoading && items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-mono text-xs">
                    Loading accounts directory...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                    No organizations match your current search or filter.
                  </td>
                </tr>
              ) : (
                items.map((org) => {
                  const isFrozen = org.status === 'FROZEN';
                  return (
                    <tr
                      key={org.id}
                      className="hover:bg-admin-850/60 transition-colors group"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white group-hover:text-brand-300 transition-colors">
                          {org.name}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          ID: {org.id.slice(0, 12)}...
                          {org.phone && ` • ${org.phone}`}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase bg-slate-800 text-slate-300 border border-slate-700">
                          {org.businessType}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {isFrozen ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <Lock className="w-3 h-3" />
                            Frozen
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            Active
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-slate-300">
                          <Users className="w-3.5 h-3.5 text-slate-500" />
                          <span>{org._count.users} members</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-300">
                        {org.businessType === 'isp' ? (
                          <div className="flex items-center gap-1">
                            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{org._count.subscribers} subs</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Package className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{org._count.products} products</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {new Date(org.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/accounts/${org.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-admin-800 hover:bg-brand-600 hover:text-white text-slate-300 text-xs font-medium transition-colors"
                        >
                          Manage <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-admin-800 flex items-center justify-between bg-admin-950/40">
            <div className="text-xs text-slate-500">
              Showing page <span className="text-slate-300 font-bold">{page + 1}</span> of{' '}
              <span className="text-slate-300 font-bold">{totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="p-1.5 rounded-lg border border-admin-800 text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg border border-admin-800 text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
