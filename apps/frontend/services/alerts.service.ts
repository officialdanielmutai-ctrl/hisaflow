import { apiGet, apiPost } from '@/lib/api-client';

export interface Alert {
  id: string;
  type: string;
  message: string;
  severity: 'WARNING' | 'CRITICAL';
  createdAt: string;
  product: { name: string; unit: string } | null;
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
  await apiPost('/alerts/check', {}, token, organizationId);
}
