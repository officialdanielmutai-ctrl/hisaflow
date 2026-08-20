'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';
import { getMyOrganizations, type OrgMembership } from '@/services/organizations.service';

const SESSION_KEY = 'hf:org';
const ACTIVE_ORG_KEY = 'hf:active_org_id';

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

function getActiveOrgId(): string | null {
  try { return localStorage.getItem(ACTIVE_ORG_KEY); } catch { return null; }
}

function saveActiveOrgId(id: string) {
  try { localStorage.setItem(ACTIVE_ORG_KEY, id); } catch {}
}

// -- Context ------------------------------------------------------------------
interface OrganizationContextType {
  membership: OrgMembership | null;
  allMemberships: OrgMembership[];
  loading: boolean;
  error: string | null;
  setActiveOrgId: (id: string) => void;
}

const OrganizationContext = createContext<OrganizationContextType>({
  membership: null,
  allMemberships: [],
  loading: true,
  error: null,
  setActiveOrgId: () => {},
});

// -- Provider -----------------------------------------------------------------
export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded } = useAuth();

  // isMounted starts false — keeps loading=true until client has hydrated.
  // This prevents OrgGate from seeing (loading=false, membership=null) on first render.
  const [isMounted, setIsMounted] = useState(false);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
  const [cachedOrg, setCachedOrg] = useState<OrgMembership | null>(null);

  useEffect(() => {
    setCachedOrg(readCachedOrg());
    setActiveOrgIdState(getActiveOrgId());
    setIsMounted(true);
  }, []);

  const { data: allMemberships, isLoading, error } = useSWR<OrgMembership[]>(
    // Gate on both Clerk being ready AND component being mounted
    isLoaded && isMounted ? 'org-memberships' : null,
    async () => {
      const token = await getToken();
      if (!token) return [];
      return getMyOrganizations(token);
    },
    {
      dedupingInterval: 60_000,
      revalidateOnFocus: false,
      revalidateOnMount: true,
    },
  );

  // Pick the active membership — user's stored choice, else first in list
  const activeMembership: OrgMembership | null =
    allMemberships && allMemberships.length > 0
      ? (activeOrgId
          ? (allMemberships.find(m => m.organization.id === activeOrgId) ?? allMemberships[0])
          : allMemberships[0])
      : cachedOrg;

  // Keep session cache in sync with active membership
  useEffect(() => {
    if (activeMembership) writeCachedOrg(activeMembership);
  }, [activeMembership]);

  // loading = true whenever: not mounted yet, Clerk not ready, or SWR fetch in flight
  // This ensures OrgGate never sees (loading=false, membership=null) prematurely
  const loading = !isMounted || !isLoaded || isLoading;

  const handleSetActiveOrgId = (id: string) => {
    saveActiveOrgId(id);
    // Hard navigate to / so all SWR caches reset for the new org context
    window.location.href = '/';
  };

  return (
    <OrganizationContext.Provider
      value={{
        membership: activeMembership,
        allMemberships: allMemberships ?? [],
        loading,
        error: error ? 'Failed to load organizations' : null,
        setActiveOrgId: handleSetActiveOrgId,
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
