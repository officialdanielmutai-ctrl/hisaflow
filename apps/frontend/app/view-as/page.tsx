'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Eye, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api-client';

function ViewAsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string>('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('No impersonation token provided in URL.');
      return;
    }

    async function activate() {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/impersonation/validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-impersonation-token': token!,
          },
          body: JSON.stringify({ token }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || `Validation failed (${res.status})`);
        }

        const data = await res.json();
        setOrgName(data.targetOrgName);

        // Store session in sessionStorage
        sessionStorage.setItem('hf:impersonation_token', token!);
        sessionStorage.setItem(
          'hf:impersonation_meta',
          JSON.stringify({
            targetOrgId: data.targetOrgId,
            targetOrgName: data.targetOrgName,
            adminName: data.adminName,
            reason: data.reason,
            expiresAt: data.expiresAt,
          })
        );
        sessionStorage.setItem('hf:active_org_id', data.targetOrgId);
        try {
          localStorage.setItem('hf:active_org_id', data.targetOrgId);
        } catch {}

        sessionStorage.setItem(
          'hf:org',
          JSON.stringify({
            id: `imp-${data.targetOrgId}`,
            role: 'OWNER',
            organization: {
              id: data.targetOrgId,
              name: data.targetOrgName,
              businessType: 'RETAIL',
              currency: 'KES',
              country: 'KE',
            },
          })
        );

        setStatus('success');

        // Redirect to dashboard
        setTimeout(() => {
          router.replace('/');
        }, 800);
      } catch (err: any) {
        setStatus('error');
        setErrorMsg(err.message || 'Failed to activate View-As session');
      }
    }

    activate();
  }, [token, router]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 text-center">
        {status === 'verifying' && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto animate-pulse">
              <Eye className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h1 className="text-lg font-bold text-white">Validating View-As Session</h1>
              <p className="text-xs text-slate-400">
                Verifying token signature, expiration, and organization context...
              </p>
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h1 className="text-lg font-bold text-white">View-As Session Activated</h1>
              <p className="text-xs text-emerald-400 font-medium">
                Entering read-only mode for <strong>{orgName}</strong>...
              </p>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h1 className="text-lg font-bold text-white">Session Activation Failed</h1>
              <p className="text-xs text-rose-400 font-mono bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">
                {errorMsg}
              </p>
              <p className="text-xs text-slate-400 pt-2">
                This token may have expired (15-min limit) or been revoked by a Super Admin.
              </p>
            </div>
            <button
              onClick={() => router.replace('/')}
              className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
            >
              Return to App Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ViewAsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center text-xs font-mono text-slate-500">
          Loading View-As handler...
        </div>
      }
    >
      <ViewAsContent />
    </Suspense>
  );
}
