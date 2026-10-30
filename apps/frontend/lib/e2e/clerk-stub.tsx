'use client';

import React from 'react';

/**
 * Test-only Clerk stub, aliased in place of `@clerk/nextjs` by
 * `next.config.js` when `NEXT_PUBLIC_E2E_AUTH=true` (and never built into a
 * production bundle otherwise). It returns a synthetic identity whose bearer
 * token the backend's test-only guard understands, so the seeded Duty 1
 * browser sweep can render the authenticated app without a Clerk session.
 *
 * `tsc` still type-checks call sites against the real Clerk types (the alias
 * is webpack-only), so this file only needs to be runtime-compatible.
 */
const E2E_CLERK_ID = process.env.NEXT_PUBLIC_E2E_CLERK_ID ?? 'e2e-owner';
const TOKEN = `e2e.${E2E_CLERK_ID}`;

// Keep these references stable across renders. Real Clerk memoises auth
// helpers; returning fresh functions here makes effects that depend on
// `getToken` re-run after every state update and can loop in the test harness.
const getToken = async () => TOKEN;

const e2eUser = {
  id: E2E_CLERK_ID,
  firstName: 'E2E',
  lastName: 'Owner',
  fullName: 'E2E Owner',
  username: 'e2e-owner',
  imageUrl: '',
  primaryEmailAddress: { emailAddress: 'e2e-owner@example.test' },
  emailAddresses: [{ emailAddress: 'e2e-owner@example.test' }],
  publicMetadata: {},
};

export function ClerkProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useAuth() {
  return {
    isLoaded: true,
    isSignedIn: true,
    userId: E2E_CLERK_ID,
    sessionId: 'e2e-session',
    getToken,
  };
}

export function useUser() {
  return { isLoaded: true, isSignedIn: true, user: e2eUser };
}

export function useClerk() {
  return { loaded: true, signOut: async () => {}, openUserProfile: () => {} };
}

export function UserButton(_props: Record<string, unknown>) {
  return <span data-testid="e2e-user-button" aria-hidden="true" />;
}

export function SignOutButton({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

export function SignIn(_props: Record<string, unknown>) {
  return <div data-testid="e2e-sign-in" />;
}

export function SignUp(_props: Record<string, unknown>) {
  return <div data-testid="e2e-sign-up" />;
}
