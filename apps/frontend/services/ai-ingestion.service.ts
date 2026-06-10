import { apiPost } from '@/lib/api-client';

export interface ParsedAction {
  itemId: string | null;
  itemName: string;
  type: 'SALE' | 'PURCHASE';
  quantity: number;
  confidence: 'HIGH' | 'LOW';
}

export async function parseInventoryText(
  text: string,
  token: string,
  organizationId: string,
): Promise<ParsedAction[]> {
  const response = await apiPost<{ actions: ParsedAction[] }>(
    '/ai-ingestion/parse',
    token,
    organizationId,
    { text },
  );
  return response.actions;
}
