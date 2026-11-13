import { API_BASE_URL, getImpersonationToken } from './api-client';

export type ExportDataset =
  | 'inventory'
  | 'transactions'
  | 'invoices'
  | 'fee-invoices'
  | 'credit'
  | 'tax';

function filenameFromDisposition(header: string | null, fallback: string) {
  if (!header) return fallback;
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match?.[1] ?? fallback;
}

/**
 * Downloads an owner-scoped CSV through the authenticated API. The browser
 * cannot attach the Clerk token to a plain <a href>, so we fetch the blob and
 * trigger a download from an object URL instead.
 */
export async function downloadOwnerExport(
  dataset: ExportDataset,
  token: string,
  organizationId: string,
): Promise<void> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'x-organization-id': organizationId,
  };
  const impersonationToken = getImpersonationToken();
  if (impersonationToken) {
    headers['x-impersonation-token'] = impersonationToken;
  }

  const response = await fetch(`${API_BASE_URL}/exports/${dataset}`, {
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Export failed (${response.status})`);
  }

  const blob = await response.blob();
  const filename = filenameFromDisposition(
    response.headers.get('content-disposition'),
    `${dataset}.csv`,
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
