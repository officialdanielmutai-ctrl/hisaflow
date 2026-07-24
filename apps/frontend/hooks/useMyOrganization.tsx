'use client';

import React, { createContext, useContext } from 'react';
import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';
import { getMyOrganizations, type OrgMembership } from '@/services/organizations.service';

// -- Session-storage helpers --------------------------------------------------
// We persist the org membership in sessionStorage so the next page load can
// use it as fallbackData -- the org appears instantly with zero network wait,
// while SWR still silently validates it in the background.
const SESSION_KEY = 'hf:org';

function readCachedOrg(): OrgMembership | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as OrgMembership) : null;
  } catch {
    return null;
  }
}

function writeCachedOrg(org: OrgMembership | null) {
  try {
    if (org) sessionStorage.setItem(SESSION_KEY, JSON.stringify(org));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}

// -- Context ------------------------------------------------------------------
interface OrganizationContextType {
  membership: OrgMembership | null;
  loading: boolean;
  error: string | null;
}

const OrganizationContext = createContext<OrganizationContextType>({
  membership: null,
  loading: true,
  error: null,
});

// -- Provider -----------------------------------------------------------------
export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded } = useAuth();

  const { data, isLoading, error } = useSWR<OrgMembership | null>(
    // Don't start until Clerk is ready
    isLoaded ? 'org-membership' : null,
    async () => {
      const token = await getToken();
      if (!token) return null;
      const memberships = await getMyOrganizations(token);
      const org = memberships[0] ?? null;
      writeCachedOrg(org); // Keep cache fresh after every successful fetch
      return org;
    },
    {
      fallbackData: readCachedOrg(),  // Instant org data from last session
      dedupingInterval: 60_000,       // Re-fetch at most once per minute
      revalidateOnFocus: false,       // Org does not change on tab switch
      revalidateOnMount: true,        // Always validate on mount for data integrity
    },
  );

  return (
    <OrganizationContext.Provider
      value={{
        membership: data ?? null,
        // If we already have fallback data, do not block on the background refetch
        loading: isLoading && !data,
        error: error ? 'Failed to load organization' : null,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

// -- Hook ---------------------------------------------------------------------
export function useMyOrganization() {
  return useContext(OrganizationContext);
}
