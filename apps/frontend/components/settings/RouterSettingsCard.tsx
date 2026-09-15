'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@clerk/nextjs';
import {
  Server,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldAlert,
  X,
  ExternalLink,
} from 'lucide-react';
import {
  getRouters,
  createRouter,
  deleteRouter,
  testRouterConnection,
  type Router,
  type CreateRouterInput,
  type TestConnectionResult,
} from '@/services/routers.service';

interface RouterSettingsCardProps {
  orgId: string;
  isOwner: boolean;
}

export default function RouterSettingsCard({ orgId, isOwner }: RouterSettingsCardProps) {
  const { getToken } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestConnectionResult>>({});

  const [form, setForm] = useState<CreateRouterInput>({
    label: '',
    host: '',
    port: 8729,
    apiUsername: '',
    apiPassword: '',
  });

  const { data: routers = [], mutate, isLoading } = useSWR(
    orgId ? ['routers', orgId] : null,
    async () => {
      const token = await getToken();
      if (!token) return [];
      return getRouters(token, orgId);
    },
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label || !form.host || !form.apiUsername || !form.apiPassword) return;

    setIsSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await createRouter(token, orgId, {
        ...form,
        port: form.port ? Number(form.port) : 8729,
      });
      await mutate();
      setShowAddModal(false);
      setForm({ label: '', host: '', port: 8729, apiUsername: '', apiPassword: '' });
    } catch (err: any) {
      alert(err.message || 'Failed to add router');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Are you sure you want to remove router "${label}"?`)) return;
    try {
      const token = await getToken();
      if (!token) return;
      await deleteRouter(token, orgId, id);
      await mutate();
    } catch (err: any) {
      alert(err.message || 'Failed to remove router');
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await testRouterConnection(token, orgId, id);
      setTestResults((prev) => ({ ...prev, [id]: res }));
      await mutate();
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [id]: { success: false, error: err.message || 'Test failed' },
      }));
    } finally {
      setTestingId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-blue-100 p-2 text-blue-600">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-base">MikroTik Routers</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Manage live router connections for automated PPPoE and Hotspot billing suspension.
            </p>
          </div>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 bg-[var(--color-accent)] text-white px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Router
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="p-4 text-center text-xs text-[var(--color-text-secondary)] animate-pulse">
          Loading router connections...
        </div>
      ) : routers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center">
          <Server className="h-8 w-8 text-[var(--color-text-secondary)] mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium">No routers connected yet</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-sm mx-auto">
            Connect your MikroTik access router (API-SSL port 8729) to enable automated subscriber suspension and reconnection.
          </p>
          {isOwner && (
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-3 text-xs text-[var(--color-accent)] font-semibold hover:underline"
            >
              + Register First Router
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {routers.map((router) => {
            const testResult = testResults[router.id];
            const isTesting = testingId === router.id;

            return (
              <div
                key={router.id}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{router.label}</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        router.connectionStatus === 'CONNECTED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : router.connectionStatus === 'ERROR'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {router.connectionStatus === 'CONNECTED' && <CheckCircle2 className="h-3 w-3" />}
                      {router.connectionStatus === 'ERROR' && <AlertCircle className="h-3 w-3" />}
                      {router.connectionStatus === 'DISCONNECTED' && <Clock className="h-3 w-3" />}
                      {router.connectionStatus}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)] flex items-center gap-2 flex-wrap">
                    <span>
                      {router.host}:{router.port}
                    </span>
                    <span>•</span>
                    <span>User: {router.apiUsername}</span>
                    {router._count?.subscribers !== undefined && (
                      <>
                        <span>•</span>
                        <span>{router._count.subscribers} subscriber(s) linked</span>
                      </>
                    )}
                  </div>
                  {router.lastTestedAt && (
                    <p className="text-[10px] text-[var(--color-text-secondary)]">
                      Last tested: {new Date(router.lastTestedAt).toLocaleString()}
                    </p>
                  )}
                  {testResult && (
                    <div
                      className={`text-xs mt-1 font-medium ${
                        testResult.success ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      {testResult.success
                        ? `✓ Verified identity "${testResult.routerIdentity || 'OK'}" in ${testResult.latencyMs}ms`
                        : `✗ Test failed: ${testResult.error}`}
                    </div>
                  )}
                  {router.lastError && !testResult && (
                    <p className="text-xs text-red-500 mt-1">Error: {router.lastError}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleTest(router.id)}
                    disabled={isTesting}
                    className="flex items-center gap-1 border border-[var(--color-border)] px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-[var(--color-bg-surface)] transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${isTesting ? 'animate-spin' : ''}`} />
                    {isTesting ? 'Testing...' : 'Test Connection'}
                  </button>
                  {isOwner && (
                    <button
                      onClick={() => handleDelete(router.id, router.label)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove router"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Router Modal ──────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base">Connect MikroTik Router</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[var(--color-text-secondary)] hover:text-red-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Non-dismissible Security Callout */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 mb-4 text-xs text-amber-900 flex items-start gap-2.5">
              <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block mb-1">Required Security Setting</strong>
                To protect against public port-scanning attacks, restrict API-SSL access in RouterOS to HisaFlow's backend IP:
                <code className="block bg-amber-100 text-amber-950 font-mono text-[11px] p-1.5 rounded mt-1.5 break-all select-all">
                  /ip service set api-ssl address=&lt;hisaflow-backend-ip&gt;
                </code>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                  Router Label / POP Name *
                </label>
                <input
                  required
                  placeholder="e.g. Tower A - Main Gateway"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                    Host / Public IP *
                  </label>
                  <input
                    required
                    placeholder="e.g. 197.232.10.5"
                    value={form.host}
                    onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--color-text-secondary)]">Port</label>
                  <input
                    required
                    type="number"
                    value={form.port}
                    onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                  API Username *
                </label>
                <input
                  required
                  placeholder="e.g. hisaflow-api"
                  value={form.apiUsername}
                  onChange={(e) => setForm((f) => ({ ...f, apiUsername: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                  API Password *
                </label>
                <input
                  required
                  type="password"
                  placeholder="••••••••••••"
                  value={form.apiPassword}
                  onChange={(e) => setForm((f) => ({ ...f, apiPassword: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none"
                />
                <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
                  Credentials are encrypted with AES-256-CBC with a unique IV before being stored.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSubmitting ? 'Connecting...' : 'Save & Register Router'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
