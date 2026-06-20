import { apiGet, apiPost } from '@/lib/api-client';

export interface Alert {
  id: string;
  type: string;
  severity: 'WARNING' | 'CRITICAL' | 'INFO';
  title: string;
  description: string;
  createdAt: string;
  item: { name: string; unit: string } | null;
}

export async function getActiveAlerts(
  token: string,
  organizationId: string,
): Promise<Alert[]> {
  return apiGet<Alert[]>('/alerts', token, organizationId);
}

export async function triggerAlertCheck(
  token: string,
  organizationId: string,
): Promise<void> {
  await apiPost('/alerts/check', token, organizationId, {});
}

export async function resolveAlert(
  alertId: string,
  token: string,
  organizationId: string,
): Promise<void> {
  return apiPost<void>(
    `/alerts/${alertId}/resolve`,
    token,
    organizationId,
    {},
  );
}
