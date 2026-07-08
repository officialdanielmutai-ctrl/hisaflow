'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getMyOrganizations, type OrgMembership } from '@/services/organizations.service';

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

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [membership, setMembership] = useState<OrgMembership | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { getToken, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    
    let isMounted = true;
    
    async function fetchOrg() {
      try {
        const token = await getToken();
        if (!token) {
          if (isMounted) setLoading(false);
          return;
        }
        const memberships = await getMyOrganizations(token);
        if (memberships.length > 0 && isMounted) {
          setMembership(memberships[0]);
        }
      } catch (err) {
        console.error(err);
        if (isMounted) setError('Failed to load organization');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    
    fetchOrg();
    
    return () => {
      isMounted = false;
    };
  }, [getToken, isLoaded]);

  return (
    <OrganizationContext.Provider value={{ membership, loading, error }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useMyOrganization() {
  return useContext(OrganizationContext);
}
