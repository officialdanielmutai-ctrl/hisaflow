import React from 'react';
import { Construction, CreditCard, ArrowUpRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function BillingPlaceholderPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-8">
      {/* Banner Card */}
      <div className="bg-admin-900/80 border border-admin-800 rounded-2xl p-8 shadow-xl text-center space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 transform translate-x-8 -translate-y-8 w-48 h-48 bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
          <Construction className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Phase F Roadmap Feature
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Billing Administration Module</h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            This module is being built in conjunction with the <strong>HisaFlow Paywall & Subscription Engine</strong> (
            <code className="text-xs font-mono text-slate-300 bg-admin-800 px-1.5 py-0.5 rounded">hisaflow-paywall.md</code> Phase F).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left max-w-2xl mx-auto pt-4">
          <div className="p-4 rounded-xl bg-admin-950 border border-admin-800 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <CheckCircle2 className="w-4 h-4 text-brand-400" />
              <span>Subscription Governance</span>
            </div>
            <p className="text-xs text-slate-400">
              Inspect tier utilization, active billing cycles, and seat limits per organization.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-admin-950 border border-admin-800 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <CheckCircle2 className="w-4 h-4 text-brand-400" />
              <span>Payment Retries & Grace Controls</span>
            </div>
            <p className="text-xs text-slate-400">
              Manually trigger Paystack settlement retries and grant temporary grace extensions without code.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-admin-950 border border-admin-800 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <CheckCircle2 className="w-4 h-4 text-brand-400" />
              <span>Revenue Reconciliation</span>
            </div>
            <p className="text-xs text-slate-400">
              Compare expected recurring ledger values against realized Paystack MPESA & card receipts.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-admin-950 border border-admin-800 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <CheckCircle2 className="w-4 h-4 text-brand-400" />
              <span>Refunds & Adjustments</span>
            </div>
            <p className="text-xs text-slate-400">
              Execute customer credit notes and partial refunds with mandatory audit reason logging.
            </p>
          </div>
        </div>

        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-admin-800 hover:bg-admin-700 text-xs font-medium text-slate-200 transition-colors"
          >
            ← Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
