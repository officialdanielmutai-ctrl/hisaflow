import { useQuery } from '@tanstack/react-query';
import { getActiveAlerts, Alert } from '@/services/alerts.service';
import { useAuth } from '@clerk/nextjs';
import { useOrganization } from '@clerk/nextjs';

export function useAlerts() {
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const orgId = (organization?.publicMetadata as any)?.organizationId;
  const tokenPromise = getToken();

  return useQuery<Alert[]>({
    queryKey: ['alerts', orgId],
    queryFn: async () => {
      const token = await tokenPromise;
      if (!token || !orgId) throw new Error('Missing auth');
      return getActiveAlerts(token, orgId);
    },
    enabled: !!orgId,
  });
}
