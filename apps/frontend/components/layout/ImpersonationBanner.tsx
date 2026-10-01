'use client';

import React, { useEffect, useState } from 'react';
import { ShieldAlert, LogOut } from 'lucide-react';

interface ImpersonationMeta {
  targetOrgId: string;
  targetOrgName: string;
  adminName: string;
  reason?: string;
  expiresAt?: string;
}

export default function ImpersonationBanner() {
  const [meta, setMeta] = useState<ImpersonationMeta | null>(null);

  useEffect(() => {
    try {
      const token = sessionStorage.getItem('hf:impersonation_token');
      const rawMeta = sessionStorage.getItem('hf:impersonation_meta');
      if (token && rawMeta) {
        setMeta(JSON.parse(rawMeta));
      } else {
        setMeta(null);
      }
    } catch {
      setMeta(null);
    }
  }, []);

  const handleExit = () => {
    try {
      sessionStorage.removeItem('hf:impersonation_token');
      sessionStorage.removeItem('hf:impersonation_meta');
    } catch {
      /* sessionStorage may be unavailable */
    }
    window.location.href = '/';
  };

  if (!meta) return null;

  return (
    <div className="sticky top-0 z-[100] w-full bg-amber-500 text-slate-950 px-4 py-2 text-xs font-semibold shadow-md flex items-center justify-between gap-3 border-b border-amber-600">
      <div className="flex items-center gap-2 min-w-0">
        <ShieldAlert className="w-4 h-4 shrink-0 text-slate-950" />
        <span className="truncate">
          <strong>ADMIN VIEW-AS MODE (READ-ONLY)</strong> — Acting as{' '}
          <span className="underline decoration-slate-950 font-bold">{meta.targetOrgName}</span>
          {meta.adminName && ` (Audited: ${meta.adminName})`}
        </span>
      </div>

      <button
        onClick={handleExit}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-slate-950 text-white hover:bg-slate-800 text-[11px] font-bold shrink-0 transition-colors shadow-sm"
      >
        <LogOut className="w-3.5 h-3.5" />
        Exit View-As
      </button>
    </div>
  );
}
