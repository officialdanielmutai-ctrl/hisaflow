import React from 'react';
import { SignIn } from '@clerk/nextjs';
import { Shield } from 'lucide-react';

export default function AdminSignInPage() {
  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center space-y-2">
        <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center mx-auto shadow-lg shadow-brand-500/20">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-lg font-bold text-white tracking-tight">HisaFlow Internal Access</h1>
        <p className="text-xs text-slate-400">
          Authorized team members only. Access is monitored and audited under compliance policies.
        </p>
      </div>

      <div className="flex justify-center">
        <SignIn
          appearance={{
            elements: {
              card: 'bg-admin-900 border border-admin-800 shadow-xl',
              headerTitle: 'text-white text-base',
              headerSubtitle: 'text-slate-400 text-xs',
              formFieldLabel: 'text-slate-300 text-xs',
              formFieldInput: 'bg-admin-950 border-admin-800 text-white text-xs',
              formButtonPrimary: 'bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold',
              footerActionLink: 'text-brand-400 hover:text-brand-300 text-xs',
            },
          }}
        />
      </div>
    </div>
  );
}
