'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getMyOrganizations, type OrgMembership } from '@/services/organizations.service';

export function useMyOrganization() {
  const [membership, setMembership] = useState<OrgMembership | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();

  useEffect(() => {
    async function fetchOrg() {
      try {
        const token = await getToken();
        if (!token) {
          setLoading(false);
          return;
        }
        const memberships = await getMyOrganizations(token);
        if (memberships.length > 0) {
          setMembership(memberships[0]);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load organization');
      } finally {
        setLoading(false);
      }
    }
    fetchOrg();
  }, [getToken]);

  return { membership, loading, error };
}
