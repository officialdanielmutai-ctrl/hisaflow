'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { AdminShell } from '../../components/admin-shell';
import { adminFetch } from '../../lib/api-client';
import {
  CheckSquare,
  Plus,
  Filter,
  Search,
  UserCheck,
  Building2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  X,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  FileText,
  User,
  ArrowRight,
} from 'lucide-react';
import type {
  AdminWorkItem,
  WorkItemListResponse,
  AdminRosterItem,
  WorkItemPriority,
  WorkItemStatus,
} from '../../lib/types';

export default function WorkQueuePage() {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<AdminWorkItem | null>(null);

  // Create modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<WorkItemPriority>('MEDIUM');
  const [assignedAdminId, setAssignedAdminId] = useState('');
  const [orgName, setOrgName] = useState('');

  // Resolution modal state
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolutionError, setResolutionError] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Queries
  const queryParams = new URLSearchParams();
  if (statusFilter !== 'ALL') queryParams.set('status', statusFilter);
  if (priorityFilter !== 'ALL') queryParams.set('priority', priorityFilter);
  if (search.trim()) queryParams.set('search', search.trim());

  const fetchUrl = `/admin/work-queue?${queryParams.toString()}`;

  const { data, mutate, isLoading } = useSWR<WorkItemListResponse>(
    fetchUrl,
    (url: string) => adminFetch<WorkItemListResponse>(url),
  );

  const { data: admins } = useSWR<AdminRosterItem[]>(
    '/admin/work-queue/admins',
    (url: string) => adminFetch<AdminRosterItem[]>(url),
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    try {
      const assignedAdmin = admins?.find((a) => a.id === assignedAdminId);
      await adminFetch('/admin/work-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          priority,
          assignedToAdminId: assignedAdminId || undefined,
          assignedToAdminName: assignedAdmin?.name || undefined,
          organizationName: orgName.trim() || undefined,
        }),
      });

      setFeedback({ type: 'success', message: 'Work item created successfully.' });
      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
      setAssignedAdminId('');
      setOrgName('');
      setIsCreateModalOpen(false);
      mutate();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to create work item.' });
    }
  };

  const handleUpdate = async (id: string, updates: Partial<AdminWorkItem> & { resolutionNote?: string }) => {
    try {
      const updated = await adminFetch<AdminWorkItem>(`/admin/work-queue/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      setFeedback({ type: 'success', message: 'Work item updated.' });
      mutate();
      setSelectedItem(updated);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Update failed.' });
      throw err;
    }
  };

  const handleAssigneeChange = async (adminId: string) => {
    if (!selectedItem) return;
    const assignedAdmin = admins?.find((a) => a.id === adminId);
    await handleUpdate(selectedItem.id, {
      assignedToAdminId: adminId || (null as any),
      assignedToAdminName: assignedAdmin?.name || (null as any),
    });
  };

  const handlePriorityChange = async (newPriority: WorkItemPriority) => {
    if (!selectedItem) return;
    await handleUpdate(selectedItem.id, { priority: newPriority });
  };

  const handleStatusChange = async (newStatus: WorkItemStatus) => {
    if (!selectedItem) return;
    if (newStatus === 'RESOLVED') {
      setIsResolving(true);
      setResolutionNote('');
      setResolutionError(null);
      return;
    }
    await handleUpdate(selectedItem.id, { status: newStatus });
  };

  const handleConfirmResolve = async () => {
    if (!selectedItem) return;
    if (!resolutionNote.trim()) {
      setResolutionError('Resolution note is strictly mandatory.');
      return;
    }

    try {
      await handleUpdate(selectedItem.id, {
        status: 'RESOLVED',
        resolutionNote: resolutionNote.trim(),
      });
      setIsResolving(false);
      setResolutionNote('');
    } catch (err: any) {
      setResolutionError(err?.message || 'Failed to resolve item.');
    }
  };

  const items = data?.items || [];

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <CheckSquare size={24} className="text-indigo-600" />
              Internal Work Allocation Queue
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Track operational tasks, merchant escalations, and support investigations with full team assignment
            </p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} /> New Work Item
          </button>
        </div>

        {/* Feedback banner */}
        {feedback && (
          <div
            className={`flex items-center justify-between rounded-xl border p-4 text-sm ${
              feedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle size={18} className="text-rose-600 shrink-0" />
              )}
              <p className="font-medium">{feedback.message}</p>
            </div>
            <button onClick={() => setFeedback(null)} className="opacity-60 hover:opacity-100">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Filters and Search Bar */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-white p-4 rounded-xl border shadow-sm">
          {/* Status filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            {['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* Priority filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-48 sm:w-64 rounded-lg border border-gray-200 py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <button
              onClick={() => mutate()}
              className="rounded border p-1.5 text-gray-500 hover:bg-gray-50"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Work Items Table */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-sm text-gray-400">
              <RefreshCw size={18} className="animate-spin mr-2" /> Loading queue...
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center text-sm text-gray-400">
              <CheckSquare size={36} className="text-gray-300 mb-2" />
              <p>No work items found matching criteria.</p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-3 text-xs text-indigo-600 font-semibold hover:underline"
              >
                Create a new work item
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                    <th className="px-5 py-3">Work Item</th>
                    <th className="px-5 py-3">Priority</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Assignee</th>
                    <th className="px-5 py-3">Merchant / Org</th>
                    <th className="px-5 py-3">Created</th>
                    <th className="px-5 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="max-w-[280px]">
                          <p className="font-semibold text-gray-900 text-sm truncate">{item.title}</p>
                          <p className="text-gray-400 text-xs truncate mt-0.5">{item.description}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                            item.priority === 'URGENT'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : item.priority === 'HIGH'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : item.priority === 'MEDIUM'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {item.priority}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold ${
                            item.status === 'RESOLVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'IN_PROGRESS'
                              ? 'bg-purple-100 text-purple-800'
                              : item.status === 'CLOSED'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {item.assignedToAdminName ? (
                          <div className="flex items-center gap-1.5 text-gray-700 font-medium">
                            <UserCheck size={14} className="text-indigo-600" />
                            <span>{item.assignedToAdminName}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">
                        {item.organizationName ? (
                          <span className="flex items-center gap-1 font-medium">
                            <Building2 size={13} className="text-gray-400" /> {item.organizationName}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-gray-400">
                        <ChevronRight size={16} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="border-b px-6 py-4 bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <CheckSquare size={18} className="text-indigo-600" /> Create Work Item
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 rounded text-gray-400 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase text-gray-500 block mb-1">Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Investigate payout dispute on account"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-gray-500 block mb-1">Description *</label>
                <textarea
                  rows={4}
                  placeholder="Details of the operational task or customer inquiry..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500 block mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as WorkItemPriority)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500 block mb-1">Assign To</label>
                  <select
                    value={assignedAdminId}
                    onChange={(e) => setAssignedAdminId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">Unassigned</option>
                    {admins?.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {admin.name} ({admin.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-gray-500 block mb-1">
                  Associated Organization Name (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Eldoret Chemist"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div className="border-t pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-lg border px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-indigo-700"
                >
                  Create Work Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedItem(null)} />
          <div className="relative z-10 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
            {/* Drawer Header */}
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-base">{selectedItem.title}</h3>
                <p className="text-xs text-gray-400 font-mono">{selectedItem.id}</p>
              </div>
              <button onClick={() => setSelectedItem(null)} className="p-1 rounded text-gray-400 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
              {/* Status & Priority Control */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-xl border bg-gray-50">
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500 block mb-1">Status</label>
                  <select
                    value={selectedItem.status}
                    onChange={(e) => handleStatusChange(e.target.value as WorkItemStatus)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500 block mb-1">Priority</label>
                  <select
                    value={selectedItem.priority}
                    onChange={(e) => handlePriorityChange(e.target.value as WorkItemPriority)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Assignment control */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-gray-500 block">Assigned Admin</label>
                <select
                  value={selectedItem.assignedToAdminId || ''}
                  onChange={(e) => handleAssigneeChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">Unassigned</option>
                  {admins?.map((admin) => (
                    <option key={admin.id} value={admin.id}>
                      {admin.name} ({admin.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-gray-500 block">Description</label>
                <div className="rounded-lg border p-3.5 bg-gray-50 text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {selectedItem.description}
                </div>
              </div>

              {/* Associated Org */}
              {selectedItem.organizationName && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase text-gray-500 block">Merchant Organization</label>
                  <div className="flex items-center gap-2 p-3 rounded-lg border bg-gray-50 text-xs font-medium text-gray-800">
                    <Building2 size={16} className="text-indigo-600" />
                    <span>{selectedItem.organizationName}</span>
                  </div>
                </div>
              )}

              {/* Resolution Note Section */}
              {selectedItem.resolutionNote && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase text-emerald-700 block flex items-center gap-1">
                    <CheckCircle2 size={14} className="text-emerald-600" /> Resolution Note
                  </label>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3.5 text-xs text-emerald-900 whitespace-pre-wrap leading-relaxed">
                    {selectedItem.resolutionNote}
                  </div>
                  {selectedItem.resolvedAt && (
                    <p className="text-[11px] text-gray-400">
                      Resolved on: {new Date(selectedItem.resolvedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {/* Metadata / Audit info */}
              <div className="text-xs text-gray-400 space-y-1 pt-4 border-t">
                <p>Created by: {selectedItem.createdByAdminName}</p>
                <p>Created on: {new Date(selectedItem.createdAt).toLocaleString()}</p>
                <p>Last updated: {new Date(selectedItem.updatedAt).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Resolution Note Modal */}
      {isResolving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Resolve Work Item</h3>
                <p className="text-xs text-gray-500">A resolution note is strictly mandatory</p>
              </div>
            </div>

            {resolutionError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 font-medium">
                {resolutionError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-gray-600 block">Resolution Note *</label>
              <textarea
                rows={4}
                placeholder="Explain what steps were taken to fix, resolve, or verify this issue..."
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-xs shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsResolving(false)}
                className="rounded-lg border px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResolve}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-700"
              >
                Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
