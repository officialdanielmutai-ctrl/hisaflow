'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';
import { getMyOrganizations, type OrgMembership } from '@/services/organizations.service';

// -- Session-storage helpers --------------------------------------------------
const SESSION_KEY = 'hf:org';

function readCachedOrg(): OrgMembership | null {
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

  // Hydration-safe cache: start as null (matches SSR), then read sessionStorage
  // on the client after mount so server and client initial renders agree.
  const [cachedOrg, setCachedOrg] = useState<OrgMembership | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setCachedOrg(readCachedOrg());
    setIsMounted(true);
  }, []);

  const { data, isLoading, error } = useSWR<OrgMembership | null>(
    // Don't start until Clerk is ready AND we've mounted (cache is available)
    isLoaded && isMounted ? 'org-membership' : null,
    async () => {
      const token = await getToken();
      if (!token) return null;
      const memberships = await getMyOrganizations(token);
      const org = memberships[0] ?? null;
      writeCachedOrg(org);
      return org;
    },
    {
      fallbackData: cachedOrg,         // Safe: only set after client mount
      dedupingInterval: 60_000,
      revalidateOnFocus: false,
      revalidateOnMount: true,
    },
  );

  return (
    <OrganizationContext.Provider
      value={{
        membership: data ?? null,
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

