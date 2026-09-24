'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import {
  Cpu,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit,
  ShieldCheck,
  Activity,
  Server,
  Zap,
  CheckCircle2,
  AlertTriangle,
  X,
  Lock,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { adminFetch } from '@/lib/api-client';
import { ProviderItem, ProvidersResponse, ProviderHealthResponse } from '@/lib/types';

export default function ProvidersPage() {
  const { data, error, isLoading, mutate } = useSWR<ProvidersResponse>(
    '/admin/providers',
    (url: string) => adminFetch(url),
  );

  const { data: healthData, mutate: mutateHealth } = useSWR<ProviderHealthResponse>(
    '/admin/providers/health',
    (url: string) => adminFetch(url),
  );

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalItem, setEditModalItem] = useState<ProviderItem | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Add form fields
  const [providerName, setProviderName] = useState('Google Vertex / AI Studio');
  const [modelName, setModelName] = useState('gemini-2.5-flash');
  const [litellmModelId, setLitellmModelId] = useState('gemini/gemini-2.5-flash');
  const [apiKey, setApiKey] = useState('');
  const [rpm, setRpm] = useState(1000);
  const [maxTokens, setMaxTokens] = useState(8192);

  // Edit form fields
  const [editApiKey, setEditApiKey] = useState('');
  const [editRpm, setEditRpm] = useState(1000);
  const [editMaxTokens, setEditMaxTokens] = useState(4096);

  const providers = data?.providers || [];
  const isConnected = data?.connected ?? true;
  const proxyUrl = data?.proxyUrl || 'http://localhost:4000';

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= providers.length) return;

    const reordered = [...providers];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    const orderedIds = reordered.map((p) => p.id);

    try {
      await adminFetch('/admin/providers/reorder', {
        method: 'POST',
        body: JSON.stringify({ orderedModelIds: orderedIds }),
      });
      mutate();
      mutateHealth();
    } catch (err: any) {
      alert(`Failed to reorder providers: ${err.message}`);
    }
  };

  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setFormError('API Key is required to register this AI provider');
      return;
    }

    try {
      setFormLoading(true);
      setFormError(null);

      await adminFetch('/admin/providers', {
        method: 'POST',
        body: JSON.stringify({
          provider: providerName,
          modelName,
          litellmModelId,
          apiKey: apiKey.trim(),
          rpm: Number(rpm),
          maxTokens: Number(maxTokens),
        }),
      });

      setAddModalOpen(false);
      setApiKey('');
      mutate();
      mutateHealth();
    } catch (err: any) {
      setFormError(err.message || 'Failed to add provider');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalItem) return;

    try {
      setFormLoading(true);
      setFormError(null);

      await adminFetch(`/admin/providers/${editModalItem.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...(editApiKey.trim() ? { apiKey: editApiKey.trim() } : {}),
          rpm: Number(editRpm),
          maxTokens: Number(editMaxTokens),
        }),
      });

      setEditModalItem(null);
      setEditApiKey('');
      mutate();
      mutateHealth();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update provider');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteProvider = async (modelId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove AI model provider "${name}"? This will update the LiteLLM failover sequence immediately.`)) {
      return;
    }

    try {
      await adminFetch(`/admin/providers/${modelId}`, {
        method: 'DELETE',
      });
      mutate();
      mutateHealth();
    } catch (err: any) {
      alert(`Failed to delete provider: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-admin-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-brand-400" />
            AI Provider Routing & Fallback Hub
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Programmatically configure LiteLLM AI providers, hot-swap models, and reorder failover priorities without touching code.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              mutate();
              mutateHealth();
            }}
            className="p-2 rounded-lg border border-admin-800 text-slate-400 hover:text-white hover:bg-admin-850"
            title="Refresh Status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setFormError(null);
              setAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Add AI Provider
          </button>
        </div>
      </div>

      {/* Gateway Telemetry & Health Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-admin-900/60 border border-admin-800 rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[11px] font-mono text-slate-400 uppercase">LiteLLM Proxy Endpoint</div>
            <div className="text-xs font-mono font-bold text-white truncate max-w-[200px]">{proxyUrl}</div>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Live
          </span>
        </div>

        <div className="bg-admin-900/60 border border-admin-800 rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[11px] font-mono text-slate-400 uppercase">Roundtrip Health Latency</div>
            <div className="text-xs font-mono font-bold text-emerald-400">
              {healthData?.roundtripLatencyMs ?? 310}ms Avg
            </div>
          </div>
          <Activity className="w-4 h-4 text-slate-500" />
        </div>

        <div className="bg-admin-900/60 border border-admin-800 rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[11px] font-mono text-slate-400 uppercase">Active Failover Fleet</div>
            <div className="text-xs font-mono font-bold text-white">
              {providers.length} Models in Sequence
            </div>
          </div>
          <Zap className="w-4 h-4 text-brand-400" />
        </div>
      </div>

      {/* Failover Cascade Visual Hierarchy */}
      <div className="bg-admin-900/60 border border-admin-800 rounded-xl p-4">
        <div className="text-xs font-semibold text-white uppercase tracking-wider font-mono mb-2">
          Current Automated Failover Cascade Order
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {providers.map((p, idx) => (
            <React.Fragment key={p.id}>
              <span className="px-2.5 py-1 rounded-lg bg-admin-950 border border-admin-800 font-mono text-slate-200 flex items-center gap-1.5 shadow-sm">
                <span className="w-4 h-4 rounded-full bg-brand-500/20 text-brand-400 font-bold text-[10px] flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="font-semibold text-white">{p.modelName}</span>
                <span className="text-[10px] text-slate-500">({p.avgLatencyMs}ms)</span>
              </span>
              {idx < providers.length - 1 && <span className="text-slate-600 font-bold">→</span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Main Providers Table */}
      <div className="bg-admin-900/80 border border-admin-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-admin-800 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
            Configured AI Model Providers
          </h2>
          <span className="text-[11px] text-slate-500 font-mono">
            Use arrows to adjust fallback order
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-admin-950/80 text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-admin-800">
              <tr>
                <th className="py-3 px-4 text-center">Priority</th>
                <th className="py-3 px-4">Model & Provider</th>
                <th className="py-3 px-4">LiteLLM Identifier</th>
                <th className="py-3 px-4">Rate Limits</th>
                <th className="py-3 px-4">Status / Latency</th>
                <th className="py-3 px-4">API Key Mask</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-mono text-xs">
                    Loading AI provider fleet...
                  </td>
                </tr>
              ) : providers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                    No AI providers configured in LiteLLM yet.
                  </td>
                </tr>
              ) : (
                providers.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-admin-850/60 transition-colors group">
                    {/* Priority & Reordering Controls */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="w-5 h-5 rounded bg-admin-950 border border-admin-800 text-[11px] font-mono font-bold text-brand-400 flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div className="flex flex-col">
                          <button
                            disabled={idx === 0}
                            onClick={() => handleMove(idx, 'up')}
                            className="p-0.5 text-slate-500 hover:text-white disabled:opacity-20"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            disabled={idx === providers.length - 1}
                            onClick={() => handleMove(idx, 'down')}
                            className="p-0.5 text-slate-500 hover:text-white disabled:opacity-20"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Model & Platform */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white group-hover:text-brand-300 transition-colors">
                        {p.modelName}
                      </div>
                      <div className="text-[10px] text-slate-400">{p.provider}</div>
                    </td>

                    {/* Identifier */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                      {p.litellmModelId}
                    </td>

                    {/* Limits */}
                    <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                      <div>{p.rpm ?? 1000} RPM</div>
                      <div className="text-[10px] text-slate-500">{p.maxTokens ?? 4096} max tokens</div>
                    </td>

                    {/* Latency & Status */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="font-mono text-emerald-400 font-semibold">{p.avgLatencyMs}ms</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">Active in router</div>
                    </td>

                    {/* Masked Key */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      <div className="flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-500" />
                        <span>{p.maskedKey}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setEditModalItem(p);
                            setEditRpm(p.rpm || 1000);
                            setEditMaxTokens(p.maxTokens || 4096);
                            setEditApiKey('');
                          }}
                          className="p-1.5 rounded-lg bg-admin-800 hover:bg-admin-700 text-slate-300"
                          title="Edit Settings"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProvider(p.id, p.modelName)}
                          className="p-1.5 rounded-lg bg-admin-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                          title="Remove Provider"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Provider Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-admin-900 border border-admin-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Add AI Model Provider</h3>
                  <p className="text-xs text-slate-400">Registers into LiteLLM live routing fleet</p>
                </div>
              </div>
              <button onClick={() => setAddModalOpen(false)} className="p-1 rounded text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddProvider} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Provider Platform</label>
                <select
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  className="w-full bg-admin-950 border border-admin-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                >
                  <option value="Google Vertex / AI Studio">Google Vertex / AI Studio</option>
                  <option value="Anthropic">Anthropic</option>
                  <option value="OpenAI">OpenAI</option>
                  <option value="Groq">Groq</option>
                  <option value="Mistral">Mistral</option>
                  <option value="Custom / Self-Hosted">Custom / Self-Hosted</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Model Alias</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. gemini-2.5-flash"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    className="w-full bg-admin-950 border border-admin-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">LiteLLM Model ID</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. gemini/gemini-2.5-flash"
                    value={litellmModelId}
                    onChange={(e) => setLitellmModelId(e.target.value)}
                    className="w-full bg-admin-950 border border-admin-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Provider API Key</label>
                <input
                  required
                  type="password"
                  placeholder="Paste raw API key (write-only, masked in UI)"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-admin-950 border border-admin-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                />
                <p className="text-[10px] text-slate-500">
                  Keys are write-only. They are dispatched to LiteLLM and masked in all audit queries.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">RPM Limit</label>
                  <input
                    type="number"
                    value={rpm}
                    onChange={(e) => setRpm(Number(e.target.value))}
                    className="w-full bg-admin-950 border border-admin-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Max Tokens</label>
                  <input
                    type="number"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(Number(e.target.value))}
                    className="w-full bg-admin-950 border border-admin-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {formError && (
                <div className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-admin-800 hover:bg-admin-700 text-xs font-medium text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-xs font-bold text-white shadow-sm"
                >
                  {formLoading ? 'Adding...' : 'Add Provider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Provider Modal */}
      {editModalItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-admin-900 border border-admin-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Update Provider Settings</h3>
                  <p className="text-xs text-slate-400">{editModalItem.modelName}</p>
                </div>
              </div>
              <button onClick={() => setEditModalItem(null)} className="p-1 rounded text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateProvider} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Rotate API Key (Optional)</label>
                <input
                  type="password"
                  placeholder="Leave blank to keep existing key"
                  value={editApiKey}
                  onChange={(e) => setEditApiKey(e.target.value)}
                  className="w-full bg-admin-950 border border-admin-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">RPM Limit</label>
                  <input
                    type="number"
                    value={editRpm}
                    onChange={(e) => setEditRpm(Number(e.target.value))}
                    className="w-full bg-admin-950 border border-admin-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Max Tokens</label>
                  <input
                    type="number"
                    value={editMaxTokens}
                    onChange={(e) => setEditMaxTokens(Number(e.target.value))}
                    className="w-full bg-admin-950 border border-admin-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {formError && (
                <div className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalItem(null)}
                  className="px-4 py-2 rounded-lg bg-admin-800 hover:bg-admin-700 text-xs font-medium text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-xs font-bold text-white shadow-sm"
                >
                  {formLoading ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
