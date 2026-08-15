'use client';

import React from 'react';
import { HisaFlowMotif } from './HisaFlowMotif';
import { usePathname } from 'next/navigation';

export function AuthShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSignUp = pathname?.includes('sign-up');

  return (
    <main className="flex flex-col min-h-screen bg-[var(--color-primary)]">
      {/* BRAND ZONE (Top ~42%) */}
      <div className="relative flex-shrink-0 h-[40vh] md:h-[45vh] w-full overflow-hidden">
        {/* Wordmark (Pulled away from shapes, upper-left) */}
        <div className="absolute top-12 left-6 md:top-16 md:left-12 z-10">
          <h1 className="text-white text-2xl font-bold tracking-tight">HisaFlow</h1>
          <div className="w-6 h-[3px] bg-white mt-1 opacity-90 rounded-full" />
        </div>

        {/* Motif (3 chevrons, anchored top-right) */}
        <div className="absolute top-0 right-0 w-[240px] h-[240px] md:w-[320px] md:h-[320px] pointer-events-none">
          <HisaFlowMotif className="w-full h-full" />
        </div>
      </div>

      {/* FORM AREA (Rises over brand zone, continuous to bottom) */}
      <div className="flex-grow bg-[#FAFAFA] rounded-t-[32px] w-full flex justify-center px-4 pt-10 pb-12 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] relative z-20">
        <div className="w-full max-w-[420px]">
          {/* Custom Headline & Subhead to replace Clerk's hidden ones */}
          <div className="mb-8 px-2">
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-gray-500 text-sm">
              {isSignUp
                ? 'Sign up to manage your business'
                : 'Sign in to manage your business'}
            </p>
          </div>

          {/* Clerk Component Slot with scoped style override to eliminate the Clerk "blob" */}
          <div className="clerk-auth-container">
            <style dangerouslySetInnerHTML={{ __html: `
              .clerk-auth-container .cl-card,
              .clerk-auth-container .cl-cardBox,
              .clerk-auth-container .cl-rootBox {
                background: transparent !important;
                box-shadow: none !important;
                border: none !important;
              }
            `}} />
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
