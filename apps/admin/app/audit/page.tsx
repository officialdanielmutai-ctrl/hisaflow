'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { AdminShell } from '../../components/admin-shell';
import { adminFetch } from '../../lib/api-client';
import {
  ShieldAlert,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  Activity,
  Layers,
  CheckCircle2,
  Copy,
  X,
  RefreshCw,
  Hash,
  ShieldCheck,
  ChevronRight,
  Info,
  Clock,
  ArrowRight,
} from 'lucide-react';
import type { AdminAuditLogEntry, AuditMetaResponse } from '../../lib/types';

interface AuditResponse {
  items: AdminAuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

const PRESET_FILTERS = [
  { label: 'All Actions', value: '' },
  { label: 'Account Freezes', value: 'org.freeze,org.unfreeze' },
  { label: 'AI Provider Changes', value: 'provider.create,provider.update,provider.reorder,provider.delete' },
  { label: 'Message Observability', value: 'message.access' },
  { label: 'Bulk Comms', value: 'comms.bulk_send,campaign.execute' },
  { label: 'Work Queue', value: 'work_item.create,work_item.status_change,work_item.reassign' },
  { label: 'Consent Toggles', value: 'consent.update' },
];

export default function AuditExplorerPage() {
  const [selectedActionPreset, setSelectedActionPreset] = useState<string>('');
  const [selectedAdminId, setSelectedAdminId] = useState<string>('');
  const [selectedActionType, setSelectedActionType] = useState<string>('');
  const [selectedTargetType, setSelectedTargetType] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [page, setPage] = useState<number>(0);

  const [selectedLog, setSelectedLog] = useState<AdminAuditLogEntry | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Meta dropdowns
  const { data: meta } = useSWR<AuditMetaResponse>(
    '/admin/audit/meta',
    (url: string) => adminFetch<AuditMetaResponse>(url),
  );

  // Query params
  const limit = 25;
  const offset = page * limit;
  const queryParams = new URLSearchParams();
  queryParams.set('limit', limit.toString());
  queryParams.set('offset', offset.toString());

  if (selectedActionType) {
    queryParams.set('actionType', selectedActionType);
  } else if (selectedActionPreset) {
    queryParams.set('actionType', selectedActionPreset.split(',')[0]);
  }

  if (selectedAdminId) queryParams.set('adminId', selectedAdminId);
  if (selectedTargetType) queryParams.set('targetType', selectedTargetType);
  if (search.trim()) queryParams.set('search', search.trim());
  if (fromDate) queryParams.set('from', new Date(fromDate).toISOString());
  if (toDate) queryParams.set('to', new Date(toDate).toISOString());

  const fetchUrl = `/admin/audit?${queryParams.toString()}`;

  const { data, mutate, isLoading } = useSWR<AuditResponse>(
    fetchUrl,
    (url: string) => adminFetch<AuditResponse>(url),
    { keepPreviousData: true },
  );

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const exportParams = new URLSearchParams(queryParams);
      exportParams.delete('limit');
      exportParams.delete('offset');

      const response = await fetch(`/api/admin/audit/export?${exportParams.toString()}`);
      const checksum = response.headers.get('X-Integrity-SHA256');
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hisaflow-audit-logs-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err: any) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const copyMetadata = () => {
    if (!selectedLog?.metadata) return;
    navigator.clipboard.writeText(JSON.stringify(selectedLog.metadata, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const logs = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ShieldAlert size={24} className="text-indigo-600" />
              Central Audit Log Explorer
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Immutable, cryptographically verifiable log of all administrative actions, configuration changes, and customer access
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
              <ShieldCheck size={14} className="text-emerald-600" />
              SHA-256 Tamper-Evident Logging
            </span>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isExporting ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
              Export Verified CSV
            </button>
          </div>
        </div>

        {/* Quick Filter Presets */}
        <div className="flex flex-wrap items-center gap-2 border-b pb-3">
          <span className="text-xs font-semibold uppercase text-gray-400 mr-1 flex items-center gap-1">
            <Filter size={12} /> Presets:
          </span>
          {PRESET_FILTERS.map((preset) => {
            const isSelected = selectedActionPreset === preset.value && !selectedActionType;
            return (
              <button
                key={preset.label}
                onClick={() => {
                  setSelectedActionPreset(preset.value);
                  setSelectedActionType('');
                  setPage(0);
                }}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Filter Controls Box */}
        <div className="rounded-xl border bg-white p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Action Type */}
          <div>
            <label className="text-[11px] font-semibold uppercase text-gray-500 block mb-1">Action Type</label>
            <select
              value={selectedActionType}
              onChange={(e) => {
                setSelectedActionType(e.target.value);
                setSelectedActionPreset('');
                setPage(0);
              }}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">All Action Types</option>
              {meta?.actionTypes.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>

          {/* Actor / Admin */}
          <div>
            <label className="text-[11px] font-semibold uppercase text-gray-500 block mb-1">Admin Actor</label>
            <select
              value={selectedAdminId}
              onChange={(e) => {
                setSelectedAdminId(e.target.value);
                setPage(0);
              }}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">All Admins</option>
              {meta?.admins.map((adm) => (
                <option key={adm.id} value={adm.id}>
                  {adm.name}
                </option>
              ))}
            </select>
          </div>

          {/* Target Type */}
          <div>
            <label className="text-[11px] font-semibold uppercase text-gray-500 block mb-1">Target Entity</label>
            <select
              value={selectedTargetType}
              onChange={(e) => {
                setSelectedTargetType(e.target.value);
                setPage(0);
              }}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">All Targets</option>
              {meta?.targetTypes.map((target) => (
                <option key={target} value={target}>
                  {target}
                </option>
              ))}
            </select>
          </div>

          {/* Date range from/to */}
          <div>
            <label className="text-[11px] font-semibold uppercase text-gray-500 block mb-1">Date Range</label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(0);
                }}
                className="w-1/2 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] focus:outline-none"
              />
              <span className="text-gray-400 text-xs">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(0);
                }}
                className="w-1/2 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] focus:outline-none"
              />
            </div>
          </div>

          {/* Search box */}
          <div>
            <label className="text-[11px] font-semibold uppercase text-gray-500 block mb-1">Keyword Search</label>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Reason, label, or action..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-sm text-gray-400">
              <RefreshCw size={18} className="animate-spin mr-2" /> Loading audit trail...
            </div>
          ) : logs.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center text-sm text-gray-400">
              <ShieldAlert size={36} className="text-gray-300 mb-2" />
              <p>No audit records match the selected filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">Admin Actor</th>
                    <th className="px-5 py-3">Action Type</th>
                    <th className="px-5 py-3">Target Entity</th>
                    <th className="px-5 py-3">Audit Reason / Justification</th>
                    <th className="px-5 py-3">IP Address</th>
                    <th className="px-5 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {logs.map((log) => {
                    const actionColor =
                      log.actionType.includes('freeze') || log.actionType.includes('delete')
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : log.actionType.includes('unfreeze') || log.actionType.includes('create')
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : log.actionType.includes('access')
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-indigo-50 text-indigo-700 border-indigo-200';

                    return (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3 whitespace-nowrap text-gray-500 font-mono text-[11px]">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-gray-900">{log.admin?.name || 'System Admin'}</span>
                            {log.admin?.role && (
                              <span className="text-[10px] bg-gray-100 text-gray-600 rounded px-1.5 py-0.2">
                                {log.admin.role}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-mono font-semibold border ${actionColor}`}>
                            {log.actionType}
                          </span>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <div className="text-gray-800 font-medium">
                            <span className="text-gray-400 uppercase text-[10px] mr-1">{log.targetType}:</span>
                            <span>{log.targetLabel || log.targetId || 'global'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 max-w-[260px] truncate text-gray-600">
                          {log.reason || '—'}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-gray-400 font-mono text-[11px]">
                          {log.ipAddress || '—'}
                        </td>
                        <td className="px-5 py-3 text-gray-400">
                          <ChevronRight size={15} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-5 py-3 text-xs text-gray-500 bg-gray-50">
              <span>
                Showing {offset + 1}–{Math.min(offset + limit, total)} of {total.toLocaleString()} events
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="rounded border px-2.5 py-1 bg-white hover:bg-gray-100 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border px-2.5 py-1 bg-white hover:bg-gray-100 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* JSON Diff & Audit Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="border-b px-6 py-4 bg-gray-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <ShieldAlert size={18} className="text-indigo-600" /> Audit Log Event Details
                </h3>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{selectedLog.id}</p>
              </div>
              <button onClick={() => setSelectedLog(null)} className="p-1 rounded text-gray-400 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Event Summary Grid */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl border bg-gray-50">
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-semibold">Action Type</span>
                  <span className="font-mono font-bold text-indigo-700 text-sm">{selectedLog.actionType}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-semibold">Actor</span>
                  <span className="font-semibold text-gray-900">{selectedLog.admin?.name || 'System'}</span>
                  <span className="text-gray-500 block">{selectedLog.admin?.email}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-semibold">Target</span>
                  <span className="font-medium text-gray-800">{selectedLog.targetType}: {selectedLog.targetLabel || selectedLog.targetId}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-semibold">Recorded At</span>
                  <span className="font-mono text-gray-700">{new Date(selectedLog.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Reason */}
              {selectedLog.reason && (
                <div className="space-y-1">
                  <span className="text-gray-400 uppercase text-[10px] font-semibold block">Justification / Reason</span>
                  <div className="p-3 rounded-lg border bg-gray-50 font-medium text-gray-800">
                    {selectedLog.reason}
                  </div>
                </div>
              )}

              {/* Before / After Diff Inspector */}
              {selectedLog.metadata?.before || selectedLog.metadata?.after ? (
                <div className="space-y-2">
                  <span className="text-gray-400 uppercase text-[10px] font-semibold block">State Modification Diff</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-rose-200 bg-rose-50/40 p-3">
                      <span className="font-bold text-rose-700 block mb-1 text-[11px]">Before State</span>
                      <pre className="font-mono text-[11px] text-rose-900 whitespace-pre-wrap">
                        {JSON.stringify(selectedLog.metadata.before, null, 2)}
                      </pre>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
                      <span className="font-bold text-emerald-700 block mb-1 text-[11px]">After State</span>
                      <pre className="font-mono text-[11px] text-emerald-900 whitespace-pre-wrap">
                        {JSON.stringify(selectedLog.metadata.after, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Raw Metadata JSON */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 uppercase text-[10px] font-semibold">Payload Metadata</span>
                  <button
                    onClick={copyMetadata}
                    className="flex items-center gap-1 text-[11px] text-indigo-600 hover:underline"
                  >
                    <Copy size={11} /> {copied ? 'Copied' : 'Copy JSON'}
                  </button>
                </div>
                <pre className="p-3 rounded-lg border bg-gray-900 text-gray-100 font-mono text-[11px] overflow-x-auto max-h-48">
                  {JSON.stringify(selectedLog.metadata || {}, null, 2)}
                </pre>
              </div>

              {/* Network Environment */}
              <div className="border-t pt-3 text-[11px] text-gray-400 space-y-0.5">
                <p>IP Address: <span className="font-mono text-gray-600">{selectedLog.ipAddress || 'Not recorded'}</span></p>
                <p>User Agent: <span className="font-mono text-gray-600 truncate block">{selectedLog.userAgent || 'Not recorded'}</span></p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t px-6 py-3.5 bg-gray-50 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-lg bg-gray-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
