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
      <div className="relative flex-shrink-0 h-[40vh] md:h-[45vh] w-full overflow-visible">
        {/* Wordmark (Pulled away from shapes, upper-left) */}
        <div className="absolute top-12 left-6 md:top-16 md:left-12 z-10">
          <h1 className="text-white text-2xl font-bold tracking-tight">HisaFlow</h1>
          <div className="w-6 h-[3px] bg-white mt-1 opacity-90 rounded-full" />
        </div>

        {/* Motif — fills full brand zone, chevrons are in the right half */}
        <div className="absolute inset-0 pointer-events-none">
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

          {/* Scoped CSS to strip every Clerk wrapper background/shadow/frame */}
          <div className="clerk-auth-container">
            <style dangerouslySetInnerHTML={{ __html: `
              /* Nuke ALL card/box chrome Clerk injects */
              .clerk-auth-container [class^="cl-"],
              .clerk-auth-container [class*=" cl-"] {
                --cl-shadow-sm: none !important;
                --cl-shadow: none !important;
                --cl-shadow-md: none !important;
                --cl-shadow-lg: none !important;
              }
              .clerk-auth-container .cl-rootBox,
              .clerk-auth-container .cl-cardBox,
              .clerk-auth-container .cl-card {
                background: transparent !important;
                background-color: transparent !important;
                box-shadow: none !important;
                border: none !important;
                border-radius: 0 !important;
                overflow: visible !important;
                padding: 0 !important;
                max-width: 100% !important;
                width: 100% !important;
              }
              /* Strip the dark footer bar Clerk renders under the sign-up form */
              .clerk-auth-container .cl-footer,
              .clerk-auth-container .cl-internal-b3fm6y,
              .clerk-auth-container [data-localization-key="signUp.start.subtitle"] {
                background: transparent !important;
                background-color: transparent !important;
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
