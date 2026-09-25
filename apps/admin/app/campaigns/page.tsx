'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { AdminShell } from '../../components/admin-shell';
import { adminFetch } from '../../lib/api-client';
import {
  Megaphone,
  Plus,
  Filter,
  Calendar,
  Mail,
  MessageSquare,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Play,
  X,
  ChevronRight,
  TrendingUp,
  MousePointerClick,
  Eye,
  RefreshCw,
  Send,
  Users,
  Sparkles,
} from 'lucide-react';
import type { MarketingCampaign, CampaignListResponse, BulkPreviewResult } from '../../lib/types';

const BUSINESS_TYPES = [
  'RETAIL',
  'PHARMACY',
  'RESTAURANT',
  'GUEST_HOUSE',
  'SCHOOL',
  'ISP',
  'WHOLESALE',
];

const PRESET_TEMPLATES = [
  {
    name: 'Scheduled Maintenance',
    subject: 'Important: Scheduled HisaFlow Maintenance Notice',
    body: 'Dear HisaFlow Partner,\n\nPlease be advised that our platform will undergo scheduled infrastructure maintenance on Sunday at 02:00 EAT. Expected downtime is under 30 minutes.\n\nThank you for your understanding.\n— The HisaFlow Operations Team',
  },
  {
    name: 'New Feature Release',
    subject: 'New on HisaFlow: Enhanced Inventory & Multi-Channel Tools',
    body: 'Hello,\n\nWe have rolled out new capabilities to your HisaFlow workspace, including faster checkout, deeper batch tracking, and real-time alerts. Log in to explore your updated dashboard!\n\nBest regards,\nThe HisaFlow Team',
  },
  {
    name: 'Compliance & Security Alert',
    subject: 'Action Required: Security & Compliance Verification',
    body: 'Security Notice:\n\nPlease ensure your organization details and authorized device roster are up to date. Review your security settings under Workspace > Settings.',
  },
];

export default function CampaignsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedCampaign, setSelectedCampaign] = useState<MarketingCampaign | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Wizard state (3 steps)
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [campaignName, setCampaignName] = useState('');
  const [channel, setChannel] = useState<'EMAIL' | 'SMS'>('EMAIL');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [orgSearch, setOrgSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [sendImmediately, setSendImmediately] = useState(true);

  // Reach estimation state
  const [reachEstimate, setReachEstimate] = useState<BulkPreviewResult | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchUrl =
    statusFilter === 'ALL'
      ? '/admin/campaigns'
      : `/admin/campaigns?status=${statusFilter}`;

  const { data, mutate, isLoading } = useSWR<CampaignListResponse>(
    fetchUrl,
    (url: string) => adminFetch<CampaignListResponse>(url),
  );

  const handleEstimateReach = async () => {
    setIsEstimating(true);
    try {
      const res = await adminFetch<BulkPreviewResult>('/admin/campaigns/estimate-reach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          criteria: {
            businessTypes: selectedTypes.length ? selectedTypes : undefined,
            orgSearch: orgSearch.trim() || undefined,
          },
          channel,
        }),
      });
      setReachEstimate(res);
    } catch (err: any) {
      console.error('Reach estimation failed:', err);
    } finally {
      setIsEstimating(false);
    }
  };

  const handleApplyTemplate = (tpl: (typeof PRESET_TEMPLATES)[0]) => {
    setTemplateName(tpl.name);
    setSubject(tpl.subject);
    setBody(tpl.body);
  };

  const resetWizard = () => {
    setWizardStep(1);
    setCampaignName('');
    setChannel('EMAIL');
    setSelectedTypes([]);
    setOrgSearch('');
    setSubject('');
    setBody('');
    setTemplateName('');
    setScheduledAt('');
    setSendImmediately(true);
    setReachEstimate(null);
    setIsWizardOpen(false);
  };

  const handleCreateCampaign = async () => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const payload = {
        name: campaignName,
        channel,
        subject: channel === 'EMAIL' ? subject : undefined,
        body,
        templateName: templateName || undefined,
        segmentCriteria: {
          businessTypes: selectedTypes.length ? selectedTypes : undefined,
          orgSearch: orgSearch.trim() || undefined,
        },
        scheduledAt: !sendImmediately && scheduledAt ? scheduledAt : undefined,
      };

      const created = await adminFetch<MarketingCampaign>('/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (sendImmediately) {
        await adminFetch(`/admin/campaigns/${created.id}/execute`, { method: 'POST' });
        setActionSuccess(`Campaign "${created.name}" created and executed immediately!`);
      } else {
        setActionSuccess(`Campaign "${created.name}" scheduled successfully!`);
      }

      resetWizard();
      mutate();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to create campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteNow = async (id: string) => {
    try {
      await adminFetch(`/admin/campaigns/${id}/execute`, { method: 'POST' });
      setActionSuccess('Campaign executed successfully!');
      mutate();
      if (selectedCampaign?.id === id) {
        const updated = await adminFetch<MarketingCampaign>(`/admin/campaigns/${id}`);
        setSelectedCampaign(updated);
      }
    } catch (err: any) {
      setActionError(err?.message || 'Execution failed');
    }
  };

  const handleCancelCampaign = async (id: string) => {
    try {
      await adminFetch(`/admin/campaigns/${id}/cancel`, { method: 'POST' });
      setActionSuccess('Campaign cancelled.');
      mutate();
      if (selectedCampaign?.id === id) {
        setSelectedCampaign((prev) => (prev ? { ...prev, status: 'CANCELLED' } : null));
      }
    } catch (err: any) {
      setActionError(err?.message || 'Cancellation failed');
    }
  };

  const campaigns = data?.campaigns || [];

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Megaphone size={24} className="text-indigo-600" />
              Marketing Campaigns Manager
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Build, schedule, segment, and track targeted multi-channel marketing campaigns
            </p>
          </div>
          <button
            onClick={() => setIsWizardOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} /> New Campaign
          </button>
        </div>

        {/* Action feedback */}
        {actionSuccess && (
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <p className="font-medium">{actionSuccess}</p>
            </div>
            <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-800">
              <X size={16} />
            </button>
          </div>
        )}

        {actionError && (
          <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-rose-600 shrink-0" />
              <p className="font-medium">{actionError}</p>
            </div>
            <button onClick={() => setActionError(null)} className="text-rose-600 hover:text-rose-800">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 border-b pb-3">
          {['ALL', 'DRAFT', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'CANCELLED'].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === tab
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab}
            </button>
          ))}
          <div className="ml-auto">
            <button
              onClick={() => mutate()}
              className="p-1.5 rounded border text-gray-500 hover:bg-gray-50"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Campaigns Table */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-sm text-gray-400">
              <RefreshCw size={18} className="animate-spin mr-2" /> Loading campaigns...
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center text-sm text-gray-400">
              <Megaphone size={36} className="text-gray-300 mb-2" />
              <p>No campaigns found in this view.</p>
              <button
                onClick={() => setIsWizardOpen(true)}
                className="mt-3 text-xs text-indigo-600 font-semibold hover:underline"
              >
                Create your first campaign
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                    <th className="px-5 py-3">Campaign Name</th>
                    <th className="px-5 py-3">Channel</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Audience Reach</th>
                    <th className="px-5 py-3">Performance</th>
                    <th className="px-5 py-3">Timeline</th>
                    <th className="px-5 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {campaigns.map((camp) => {
                    const openRate =
                      camp.deliveredCount > 0
                        ? Math.round((camp.openedCount / camp.deliveredCount) * 100)
                        : 0;
                    const clickRate =
                      camp.deliveredCount > 0
                        ? Math.round((camp.clickedCount / camp.deliveredCount) * 100)
                        : 0;

                    return (
                      <tr
                        key={camp.id}
                        onClick={() => setSelectedCampaign(camp)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{camp.name}</p>
                            <p className="text-gray-400 text-xs truncate max-w-[220px]">
                              {camp.subject || camp.body.slice(0, 50) + '...'}
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${
                              camp.channel === 'EMAIL'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {camp.channel === 'EMAIL' ? <Mail size={11} /> : <MessageSquare size={11} />}
                            {camp.channel}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                              camp.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : camp.status === 'SCHEDULED'
                                ? 'bg-blue-100 text-blue-800'
                                : camp.status === 'RUNNING'
                                ? 'bg-amber-100 text-amber-800'
                                : camp.status === 'CANCELLED'
                                ? 'bg-gray-100 text-gray-600'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {camp.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-mono">
                          {camp.recipientCount > 0 ? (
                            <span>
                              {camp.deliveredCount} / {camp.recipientCount} sent
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {camp.status === 'COMPLETED' && camp.channel === 'EMAIL' ? (
                            <div className="flex items-center gap-3 text-gray-600">
                              <span className="flex items-center gap-1" title="Open Rate">
                                <Eye size={12} className="text-blue-500" /> {openRate}%
                              </span>
                              <span className="flex items-center gap-1" title="Click Rate">
                                <MousePointerClick size={12} className="text-indigo-500" /> {clickRate}%
                              </span>
                            </div>
                          ) : camp.status === 'COMPLETED' ? (
                            <span className="text-emerald-600 font-medium">100% Delivered</span>
                          ) : (
                            <span className="text-gray-400">Pending</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">
                          {camp.executedAt
                            ? new Date(camp.executedAt).toLocaleDateString()
                            : camp.scheduledAt
                            ? `Scheduled: ${new Date(camp.scheduledAt).toLocaleDateString()}`
                            : `Created: ${new Date(camp.createdAt).toLocaleDateString()}`}
                        </td>
                        <td className="px-5 py-3.5 text-gray-400">
                          <ChevronRight size={16} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 3-Step Campaign Wizard Modal */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header & Stepper */}
            <div className="border-b px-6 py-4 bg-gray-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Create Marketing Campaign</h3>
                <p className="text-xs text-gray-500">Step {wizardStep} of 3</p>
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`h-2 rounded-full transition-all ${
                      wizardStep === step
                        ? 'w-8 bg-indigo-600'
                        : wizardStep > step
                        ? 'w-4 bg-indigo-300'
                        : 'w-4 bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              <button onClick={resetWizard} className="p-1 rounded text-gray-400 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* STEP 1: Audience & Channels */}
              {wizardStep === 1 && (
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-semibold uppercase text-gray-500 block mb-1">Campaign Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Q4 Merchant Retention & Feature Announcement"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm font-medium shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase text-gray-500 block mb-2">Delivery Channel *</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setChannel('EMAIL');
                          setReachEstimate(null);
                        }}
                        className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium ${
                          channel === 'EMAIL'
                            ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 ring-2 ring-indigo-600/20'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Mail size={16} /> Email (Resend)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setChannel('SMS');
                          setReachEstimate(null);
                        }}
                        className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium ${
                          channel === 'SMS'
                            ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 ring-2 ring-indigo-600/20'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <MessageSquare size={16} /> SMS (Africa's Talking)
                      </button>
                    </div>
                  </div>

                  {/* Business Vertical filter */}
                  <div>
                    <label className="text-xs font-semibold uppercase text-gray-500 block mb-2">
                      Target Business Verticals (optional)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {BUSINESS_TYPES.map((type) => {
                        const isSelected = selectedTypes.includes(type);
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              setSelectedTypes((prev) =>
                                prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
                              );
                              setReachEstimate(null);
                            }}
                            className={`rounded-full px-3 py-1 text-xs font-medium border ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            {type}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Org search */}
                  <div>
                    <label className="text-xs font-semibold uppercase text-gray-500 block mb-1">
                      Target Specific Merchant (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Search merchant name..."
                      value={orgSearch}
                      onChange={(e) => {
                        setOrgSearch(e.target.value);
                        setReachEstimate(null);
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  {/* Reach estimator button & card */}
                  <div className="rounded-xl border bg-gray-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-700">Estimated Reach:</span>
                      <button
                        type="button"
                        onClick={handleEstimateReach}
                        disabled={isEstimating}
                        className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1"
                      >
                        {isEstimating ? <RefreshCw size={12} className="animate-spin" /> : <Users size={12} />}
                        Recalculate
                      </button>
                    </div>

                    {reachEstimate ? (
                      <div className="grid grid-cols-2 gap-2 text-center text-xs">
                        <div className="bg-white rounded-lg p-2.5 border border-emerald-200">
                          <p className="text-lg font-bold text-emerald-600">{reachEstimate.recipientCount}</p>
                          <p className="text-gray-500">Eligible Recipients</p>
                        </div>
                        <div className="bg-white rounded-lg p-2.5 border border-amber-200">
                          <p className="text-lg font-bold text-amber-600">{reachEstimate.excludedCount}</p>
                          <p className="text-gray-500">Opted-Out (Excluded)</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">Click recalculate to evaluate target audience size.</p>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2: Content & Templates */}
              {wizardStep === 2 && (
                <div className="space-y-5">
                  {/* Template Picker */}
                  <div>
                    <label className="text-xs font-semibold uppercase text-gray-500 block mb-2 flex items-center gap-1">
                      <Sparkles size={14} className="text-indigo-600" /> Pre-built Templates
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {PRESET_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.name}
                          type="button"
                          onClick={() => handleApplyTemplate(tpl)}
                          className={`rounded-lg border p-2.5 text-left text-xs transition-colors ${
                            templateName === tpl.name
                              ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <p className="font-semibold">{tpl.name}</p>
                          <p className="text-gray-400 truncate text-[11px] mt-0.5">{tpl.subject}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {channel === 'EMAIL' && (
                    <div>
                      <label className="text-xs font-semibold uppercase text-gray-500 block mb-1">Subject Line *</label>
                      <input
                        type="text"
                        placeholder="Subject..."
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 font-medium"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold uppercase text-gray-500 block mb-1">Message Body *</label>
                    <textarea
                      rows={7}
                      placeholder="Write message content here..."
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                    {channel === 'SMS' && (
                      <p className="text-xs font-mono text-gray-400 mt-1">
                        {body.length} characters (approx. {Math.ceil(body.length / 153) || 1} SMS segment)
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: Review & Schedule */}
              {wizardStep === 3 && (
                <div className="space-y-5">
                  <div className="rounded-xl border bg-gray-50 p-4 text-xs space-y-2.5">
                    <h4 className="font-bold text-gray-900 text-sm">Campaign Summary</h4>
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-gray-500">Name:</span>
                      <span className="font-semibold text-gray-800">{campaignName}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-gray-500">Channel:</span>
                      <span className="font-semibold text-gray-800">{channel}</span>
                    </div>
                    {channel === 'EMAIL' && (
                      <div className="flex justify-between border-b pb-1.5">
                        <span className="text-gray-500">Subject:</span>
                        <span className="font-semibold text-gray-800">{subject}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-gray-500">Target Audience:</span>
                      <span className="font-semibold text-indigo-600">
                        {selectedTypes.length ? selectedTypes.join(', ') : 'All merchants'}
                      </span>
                    </div>
                  </div>

                  {/* Scheduling toggle */}
                  <div className="space-y-3">
                    <label className="text-xs font-semibold uppercase text-gray-500 block">Dispatch Time</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="scheduleOption"
                          checked={sendImmediately}
                          onChange={() => setSendImmediately(true)}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-medium text-gray-800">Dispatch Immediately</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="scheduleOption"
                          checked={!sendImmediately}
                          onChange={() => setSendImmediately(false)}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-medium text-gray-800">Schedule for Later</span>
                      </label>
                    </div>

                    {!sendImmediately && (
                      <div className="pt-2">
                        <input
                          type="datetime-local"
                          value={scheduledAt}
                          onChange={(e) => setScheduledAt(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t px-6 py-4 bg-gray-50 flex justify-between">
              {wizardStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep((prev) => (prev - 1) as any)}
                  className="rounded-lg border px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Back
                </button>
              ) : (
                <div />
              )}

              {wizardStep < 3 ? (
                <button
                  type="button"
                  disabled={!campaignName.trim() || (wizardStep === 2 && !body.trim())}
                  onClick={() => setWizardStep((prev) => (prev + 1) as any)}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
                >
                  Next Step
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmitting || (!sendImmediately && !scheduledAt)}
                  onClick={handleCreateCampaign}
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  {sendImmediately ? 'Launch Campaign' : 'Schedule Campaign'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Campaign Detail / Analytics Drawer */}
      {selectedCampaign && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedCampaign(null)} />
          <div className="relative z-10 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
            {/* Drawer Header */}
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-base">{selectedCampaign.name}</h3>
                <p className="text-xs text-gray-400 font-mono">{selectedCampaign.id}</p>
              </div>
              <button onClick={() => setSelectedCampaign(null)} className="p-1 rounded text-gray-400 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
              {/* Status & Actions */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border bg-gray-50">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Campaign Status</p>
                  <span className="font-bold text-indigo-700">{selectedCampaign.status}</span>
                </div>

                <div className="flex gap-2">
                  {['DRAFT', 'SCHEDULED'].includes(selectedCampaign.status) && (
                    <button
                      onClick={() => handleExecuteNow(selectedCampaign.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs shadow hover:bg-emerald-700"
                    >
                      <Play size={12} /> Execute Now
                    </button>
                  )}
                  {selectedCampaign.status === 'SCHEDULED' && (
                    <button
                      onClick={() => handleCancelCampaign(selectedCampaign.id)}
                      className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-600 font-semibold text-xs hover:bg-rose-50"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Performance Metrics */}
              {selectedCampaign.status === 'COMPLETED' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase text-gray-500">Delivery &amp; Engagement Metrics</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border p-3 text-center bg-gray-50/50">
                      <p className="text-lg font-bold text-gray-900">{selectedCampaign.deliveredCount}</p>
                      <p className="text-[11px] text-gray-500">Delivered</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center bg-gray-50/50">
                      <p className="text-lg font-bold text-blue-600">{selectedCampaign.openedCount}</p>
                      <p className="text-[11px] text-gray-500">Opens</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center bg-gray-50/50">
                      <p className="text-lg font-bold text-indigo-600">{selectedCampaign.clickedCount}</p>
                      <p className="text-[11px] text-gray-500">Clicks</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Content preview */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-gray-500">Message Content</h4>
                {selectedCampaign.subject && (
                  <div className="rounded-lg border p-2.5 bg-gray-50 text-xs">
                    <span className="text-gray-400 font-medium">Subject: </span>
                    <span className="font-semibold text-gray-800">{selectedCampaign.subject}</span>
                  </div>
                )}
                <div className="rounded-lg border p-3 bg-gray-50 text-xs text-gray-700 whitespace-pre-line font-mono">
                  {selectedCampaign.body}
                </div>
              </div>

              {/* Audience criteria */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-gray-500">Target Audience Criteria</h4>
                <div className="rounded-lg border p-3 text-xs bg-gray-50/50 space-y-1">
                  <p>
                    <span className="text-gray-400">Verticals: </span>
                    <span className="font-medium text-gray-800">
                      {selectedCampaign.segmentCriteria?.businessTypes?.join(', ') || 'All verticals'}
                    </span>
                  </p>
                  {selectedCampaign.segmentCriteria?.orgSearch && (
                    <p>
                      <span className="text-gray-400">Search: </span>
                      <span className="font-medium text-gray-800">{selectedCampaign.segmentCriteria.orgSearch}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Audit trail */}
              <div className="text-xs text-gray-400 space-y-1 pt-2 border-t">
                <p>Created by: {selectedCampaign.createdByAdminName}</p>
                <p>Created on: {new Date(selectedCampaign.createdAt).toLocaleString()}</p>
                {selectedCampaign.executedAt && (
                  <p>Executed on: {new Date(selectedCampaign.executedAt).toLocaleString()}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
