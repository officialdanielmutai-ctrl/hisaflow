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
  revoked: boolean;
  setActiveOrgId: (id: string) => void;
}

const OrganizationContext = createContext<OrganizationContextType>({
  membership: null,
  allMemberships: [],
  loading: true,
  error: null,
  revoked: false,
  setActiveOrgId: () => {},
});

// -- Provider -----------------------------------------------------------------
export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded } = useAuth();

  const [isMounted, setIsMounted] = useState(false);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
  const [cachedOrg, setCachedOrg] = useState<OrgMembership | null>(null);
  const [revoked, setRevoked] = useState(false);

  useEffect(() => {
    setCachedOrg(readCachedOrg());
    setActiveOrgIdState(getActiveOrgId());
    setIsMounted(true);
  }, []);

  // Set up global fetcher that traps SessionRevokedError
  const fetcher = async () => {
    try {
      const token = await getToken();
      if (!token) return [];
      return await getMyOrganizations(token);
    } catch (err: any) {
      if (err.name === 'SessionRevokedError') {
        setRevoked(true);
        return [];
      }
      throw err;
    }
  };

  const { data: allMemberships, isLoading, error } = useSWR<OrgMembership[]>(
    isLoaded && isMounted ? 'org-memberships' : null,
    fetcher,
    {
      dedupingInterval: 60_000,
      revalidateOnFocus: false,
      revalidateOnMount: true,
      shouldRetryOnError: (err) => err.name !== 'SessionRevokedError',
    },
  );

  const activeMembership: OrgMembership | null =
    allMemberships && allMemberships.length > 0
      ? (activeOrgId
          ? (allMemberships.find(m => m.organization.id === activeOrgId) ?? allMemberships[0])
          : allMemberships[0])
      : cachedOrg;

  useEffect(() => {
    if (activeMembership && !revoked) writeCachedOrg(activeMembership);
    if (revoked) writeCachedOrg(null);
  }, [activeMembership, revoked]);

  // Trap global unhandled promise rejections for SessionRevokedError
  // (e.g., from other SWR hooks or mutations calling API client)
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (event.reason?.name === 'SessionRevokedError') {
        setRevoked(true);
      }
    };
    window.addEventListener('unhandledrejection', handleRejection);
    return () => window.removeEventListener('unhandledrejection', handleRejection);
  }, []);

  const loading = (!isMounted || !isLoaded || isLoading) && !revoked;

  const handleSetActiveOrgId = (id: string) => {
    saveActiveOrgId(id);
    window.location.href = '/';
  };

  return (
    <OrganizationContext.Provider
      value={{
        membership: activeMembership,
        allMemberships: allMemberships ?? [],
        loading,
        error: error ? 'Failed to load organizations' : null,
        revoked,
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
