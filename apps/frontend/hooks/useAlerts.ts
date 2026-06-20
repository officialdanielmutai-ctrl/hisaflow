import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getActiveAlerts, Alert, resolveAlert } from '@/services/alerts.service';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';

export function useAlerts() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const orgId = membership?.organization.id;
  const tokenPromise = getToken();

  const queryClient = useQueryClient();

  const dismiss = async (alertId: string) => {
    try {
      const token = await tokenPromise;
      if (!token) return;
      await resolveAlert(alertId, token, orgId);
      queryClient.setQueryData(['alerts', orgId], (oldData: Alert[] | undefined) => {
        if (!oldData) return [];
        return oldData.filter((a) => a.id !== alertId);
      });
    } catch (error) {
      console.error('Failed to resolve alert', error);
    }
  };

  const query = useQuery<Alert[]>({
    queryKey: ['alerts', orgId],
    queryFn: async () => {
      const token = await tokenPromise;
      if (!token || !orgId) throw new Error('Missing auth');
      return getActiveAlerts(token, orgId);
    },
    enabled: !!orgId,
  });

  return { ...query, dismiss };
}
