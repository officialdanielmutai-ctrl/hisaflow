'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { AdminShell } from '../../components/admin-shell';
import { adminFetch } from '../../lib/api-client';
import {
  Send,
  Mail,
  MessageSquare,
  Users,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Info,
  DollarSign,
  Filter,
} from 'lucide-react';
import type { BulkPreviewResult, BulkSendHistoryResponse } from '../../lib/types';

const BUSINESS_TYPES = [
  'RETAIL',
  'PHARMACY',
  'RESTAURANT',
  'GUEST_HOUSE',
  'SCHOOL',
  'ISP',
  'WHOLESALE',
];

export default function BulkCommsPage() {
  const [channel, setChannel] = useState<'EMAIL' | 'SMS'>('EMAIL');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [orgSearch, setOrgSearch] = useState('');
  const [manualList, setManualList] = useState('');

  // Preview & dispatch state
  const [preview, setPreview] = useState<BulkPreviewResult | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [dispatchSuccess, setDispatchSuccess] = useState<any | null>(null);

  // Confirmation modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // History SWR
  const { data: historyData, mutate: mutateHistory, isLoading: isHistoryLoading } = useSWR<BulkSendHistoryResponse>(
    '/admin/comms/history',
    (url: string) => adminFetch<BulkSendHistoryResponse>(url),
  );

  // SMS character count logic
  const smsCharCount = body.length;
  const smsSegments = smsCharCount === 0 ? 0 : smsCharCount <= 160 ? 1 : Math.ceil(smsCharCount / 153);

  const toggleBusinessType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const getPayload = () => {
    const specificItems = manualList
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    return {
      channel,
      subject: channel === 'EMAIL' ? subject : undefined,
      body,
      businessTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
      orgSearch: orgSearch.trim() || undefined,
      ...(channel === 'EMAIL' && specificItems.length > 0 ? { specificEmails: specificItems } : {}),
      ...(channel === 'SMS' && specificItems.length > 0 ? { specificPhones: specificItems } : {}),
    };
  };

  // Preview / Calculate recipients
  const handleCalculateRecipients = async () => {
    if (!body.trim()) {
      setPreviewError('Message body cannot be empty.');
      return;
    }
    if (channel === 'EMAIL' && !subject.trim()) {
      setPreviewError('Subject line is required for Email broadcasts.');
      return;
    }

    setIsPreviewLoading(true);
    setPreviewError(null);
    setDispatchSuccess(null);

    try {
      const res = await adminFetch<BulkPreviewResult>('/admin/comms/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getPayload()),
      });
      setPreview(res);
    } catch (err: any) {
      setPreviewError(err?.message || 'Failed to calculate recipients.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Dispatch broadcast
  const handleDispatch = async () => {
    setShowConfirmModal(false);
    setIsDispatching(true);
    setDispatchError(null);
    setDispatchSuccess(null);

    try {
      const res = await adminFetch<any>('/admin/comms/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getPayload()),
      });
      setDispatchSuccess(res);
      setPreview(null);
      setBody('');
      setSubject('');
      mutateHistory();
    } catch (err: any) {
      setDispatchError(err?.message || 'Failed to dispatch broadcast.');
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <AdminShell>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Send size={24} className="text-indigo-600" />
              Bulk Communications Engine
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Multi-channel communication dispatch with non-negotiable DB-level opt-out suppression
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
              <ShieldCheck size={14} className="text-emerald-600" />
              Strict Opt-Out Guard Active
            </span>
          </div>
        </div>

        {/* Success notification */}
        {dispatchSuccess && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold">Broadcast Dispatched Successfully!</p>
                <p className="text-emerald-700 mt-0.5">
                  Delivered to {dispatchSuccess.successCount} recipients ({dispatchSuccess.failureCount} failed).
                  Batch ID: <span className="font-mono text-xs">{dispatchSuccess.id}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error notification */}
        {(dispatchError || previewError) && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="text-rose-600 shrink-0" />
              <p className="text-sm font-medium">{dispatchError || previewError}</p>
            </div>
          </div>
        )}

        {/* Main Grid: Form + Recipient Calculator */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Dispatch Config (Left 7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Channel Selection */}
            <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
              <label className="text-sm font-semibold text-gray-900 block">1. Communication Channel</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setChannel('EMAIL');
                    setPreview(null);
                  }}
                  className={`flex items-center justify-center gap-2.5 rounded-lg border p-3.5 text-sm font-medium transition-all ${
                    channel === 'EMAIL'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 ring-2 ring-indigo-600/20'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Mail size={18} className={channel === 'EMAIL' ? 'text-indigo-600' : 'text-gray-400'} />
                  <span>Email (Resend)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChannel('SMS');
                    setPreview(null);
                  }}
                  className={`flex items-center justify-center gap-2.5 rounded-lg border p-3.5 text-sm font-medium transition-all ${
                    channel === 'SMS'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 ring-2 ring-indigo-600/20'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <MessageSquare size={18} className={channel === 'SMS' ? 'text-indigo-600' : 'text-gray-400'} />
                  <span>SMS (Africa's Talking)</span>
                </button>
              </div>
            </div>

            {/* Audience Filters */}
            <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-900 block">2. Target Audience Segmentation</label>
                <span className="text-xs text-gray-400">All filters apply conjunctively (AND)</span>
              </div>

              {/* Business vertical filters */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Filter by Business Type:</p>
                <div className="flex flex-wrap gap-2">
                  {BUSINESS_TYPES.map((type) => {
                    const isSelected = selectedTypes.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          toggleBusinessType(type);
                          setPreview(null);
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })}
                  {selectedTypes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTypes([]);
                        setPreview(null);
                      }}
                      className="text-xs text-indigo-600 hover:underline px-2 py-1"
                    >
                      Clear verticals
                    </button>
                  )}
                </div>
              </div>

              {/* Org Search filter */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-gray-600">Specific Organization / User Name search:</p>
                <input
                  type="text"
                  placeholder="e.g. Acme Supermarket or John Doe"
                  value={orgSearch}
                  onChange={(e) => {
                    setOrgSearch(e.target.value);
                    setPreview(null);
                  }}
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {/* Manual list override */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-600">Manual Direct List (optional override):</p>
                  <span className="text-[11px] text-gray-400">Comma or newline separated</span>
                </div>
                <textarea
                  rows={2}
                  placeholder={
                    channel === 'EMAIL'
                      ? 'admin@store.com, owner@shop.com'
                      : '+254712345678, 0722000000'
                  }
                  value={manualList}
                  onChange={(e) => {
                    setManualList(e.target.value);
                    setPreview(null);
                  }}
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-mono shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            {/* Message Composer */}
            <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
              <label className="text-sm font-semibold text-gray-900 block">3. Message Content</label>

              {channel === 'EMAIL' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600 block">Subject Line *</label>
                  <input
                    type="text"
                    placeholder="Important update regarding your HisaFlow account"
                    value={subject}
                    onChange={(e) => {
                      setSubject(e.target.value);
                      setPreview(null);
                    }}
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 font-medium"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-600 block">Message Body *</label>
                  {channel === 'SMS' && (
                    <span className="text-xs font-mono text-gray-500">
                      {smsCharCount} chars · {smsSegments} segment{smsSegments !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <textarea
                  rows={6}
                  placeholder={
                    channel === 'EMAIL'
                      ? 'Dear HisaFlow Partner,\n\nWe are announcing scheduled system maintenance this Sunday at 02:00 EAT...'
                      : 'HisaFlow notice: Scheduled maintenance this Sunday 02:00 EAT. No action required.'
                  }
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value);
                    setPreview(null);
                  }}
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={isPreviewLoading || !body.trim()}
                  onClick={handleCalculateRecipients}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {isPreviewLoading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin text-gray-500" />
                      Calculating Audience...
                    </>
                  ) : (
                    <>
                      <Filter size={16} className="text-gray-500" />
                      Calculate Audience &amp; Preview
                    </>
                  )}
                </button>

                {preview && (
                  <button
                    type="button"
                    disabled={isDispatching || preview.recipientCount === 0}
                    onClick={() => setShowConfirmModal(true)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    <Send size={16} />
                    Dispatch to {preview.recipientCount.toLocaleString()} Users
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Recipient Calculator & Security Card (Right 5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Live Audience Card */}
            <div className="rounded-xl border bg-white p-5 shadow-sm space-y-5">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Users size={16} className="text-indigo-600" />
                Audience Calculation &amp; Compliance Card
              </h2>

              {preview ? (
                <div className="space-y-4">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3.5 text-center">
                      <p className="text-2xl font-bold text-emerald-700">{preview.recipientCount.toLocaleString()}</p>
                      <p className="text-xs font-medium text-emerald-800 mt-1 flex items-center justify-center gap-1">
                        <CheckCircle2 size={12} /> Opted-In (Eligible)
                      </p>
                    </div>

                    <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3.5 text-center">
                      <p className="text-2xl font-bold text-amber-700">{preview.excludedCount.toLocaleString()}</p>
                      <p className="text-xs font-medium text-amber-800 mt-1 flex items-center justify-center gap-1">
                        <ShieldAlert size={12} /> Opted-Out (Excluded)
                      </p>
                    </div>
                  </div>

                  {/* Filter summary */}
                  <div className="rounded-lg border bg-gray-50 p-3 text-xs space-y-1.5">
                    <p className="font-semibold text-gray-700">Filter Applied:</p>
                    <p className="text-gray-600">{preview.filterSummary}</p>
                    {preview.estimatedCost && (
                      <p className="text-indigo-600 font-medium flex items-center gap-1 mt-1">
                        <DollarSign size={12} /> Est. Cost: {preview.estimatedCost}
                      </p>
                    )}
                  </div>

                  {/* Sample roster */}
                  {preview.sampleRecipients.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Sample Audience ({preview.sampleRecipients.length} of {preview.recipientCount}):
                      </p>
                      <div className="space-y-1.5">
                        {preview.sampleRecipients.map((rec, i) => (
                          <div key={i} className="flex items-center justify-between text-xs rounded border p-2 bg-gray-50/50">
                            <div>
                              <p className="font-medium text-gray-800">{rec.name || 'HisaFlow User'}</p>
                              <p className="text-gray-500 font-mono text-[11px]">{rec.email || rec.phone}</p>
                            </div>
                            {rec.org && (
                              <span className="text-[10px] bg-gray-200 text-gray-700 rounded px-1.5 py-0.5 max-w-[100px] truncate">
                                {rec.org}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Warning banner */}
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 text-xs text-indigo-800 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-indigo-600" /> Invariant Enforced
                    </p>
                    <p className="text-indigo-700">
                      Query strictly enforces <code>WHERE consent.status = 'OPTED_IN'</code>.
                      No opted-out customer will receive this dispatch under any circumstance.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-gray-400 space-y-2">
                  <Filter size={32} className="mx-auto text-gray-300" />
                  <p>Configure audience filters and click "Calculate Audience &amp; Preview" to verify recipient numbers.</p>
                </div>
              )}
            </div>

            {/* Provider Deliverability Status */}
            <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Gateway Status</h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-indigo-600" />
                    <span className="font-medium text-gray-700">Resend (Email)</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Connected
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-gray-50">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={14} className="text-indigo-600" />
                    <span className="font-medium text-gray-700">Africa's Talking (SMS)</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Connected
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Clock size={18} className="text-indigo-600" />
                Broadcast Dispatch History
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Audit log of all past communications dispatches</p>
            </div>
            <button
              onClick={() => mutateHistory()}
              className="rounded border p-1.5 text-gray-500 hover:bg-gray-50"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {isHistoryLoading ? (
            <div className="flex h-32 items-center justify-center text-sm text-gray-400">
              <RefreshCw size={16} className="animate-spin mr-2" /> Loading history...
            </div>
          ) : !historyData?.logs?.length ? (
            <div className="py-8 text-center text-sm text-gray-400">
              No previous dispatches recorded.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Channel</th>
                    <th className="px-4 py-2.5">Subject / Snippet</th>
                    <th className="px-4 py-2.5">Dispatched By</th>
                    <th className="px-4 py-2.5">Recipients</th>
                    <th className="px-4 py-2.5">Deliveries</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {historyData.logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${
                            log.channel === 'EMAIL'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {log.channel === 'EMAIL' ? <Mail size={10} /> : <MessageSquare size={10} />}
                          {log.channel}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate text-gray-900 font-medium">
                        {log.subject || log.body.slice(0, 45) + '...'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">{log.adminName}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono">{log.recipientCount.toLocaleString()}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                        <span className="text-emerald-600 font-medium">{log.successCount}</span> ok /{' '}
                        <span className="text-rose-600 font-medium">{log.failureCount}</span> fail
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            log.status === 'SENT'
                              ? 'bg-emerald-100 text-emerald-700'
                              : log.status === 'PARTIAL_FAILURE'
                              ? 'bg-amber-100 text-amber-700'
                              : log.status === 'FAILED'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-indigo-100 text-indigo-700'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                <Send size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Confirm Broadcast Dispatch</h3>
                <p className="text-xs text-gray-500">This action will send real communications immediately</p>
              </div>
            </div>

            <div className="rounded-lg border bg-gray-50 p-3 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Channel:</span>
                <span className="font-semibold text-gray-900">{channel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Eligible Recipients:</span>
                <span className="font-bold text-emerald-600">{preview.recipientCount.toLocaleString()} users</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Opted-Out (Excluded):</span>
                <span className="font-semibold text-amber-600">{preview.excludedCount.toLocaleString()} users</span>
              </div>
              <div className="flex justify-between border-t pt-1.5">
                <span className="text-gray-500">Audience Filter:</span>
                <span className="text-gray-700">{preview.filterSummary}</span>
              </div>
            </div>

            <div className="text-xs text-gray-500">
              This broadcast will be permanently recorded in the Admin Audit Log with your admin identity.
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="rounded-lg border px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDispatch}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-700"
              >
                Yes, Dispatch Now
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
