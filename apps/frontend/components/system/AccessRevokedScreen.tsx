'use client';

import { ShieldAlert, LogOut } from 'lucide-react';
import { useClerk } from '@clerk/nextjs';

export default function AccessRevokedScreen() {
  const { signOut } = useClerk();

  const handleSignOut = () => {
    // Clear all local state
    sessionStorage.removeItem('hf:org');
    localStorage.removeItem('hf:active_org_id');
    // Force sign out completely
    signOut({ redirectUrl: '/sign-in' });
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gray-50 p-6">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-600">
          <ShieldAlert className="h-10 w-10" />
        </div>
        
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Access Revoked</h1>
        
        <p className="mb-8 text-gray-600">
          Your access to this organisation has been removed by the owner. 
          If you believe this is a mistake, please contact them directly.
        </p>

        <button
          onClick={handleSignOut}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 font-semibold text-white transition-colors hover:bg-gray-800"
        >
          <LogOut className="h-5 w-5" />
          Sign out
        </button>
      </div>
    </div>
  );
}
