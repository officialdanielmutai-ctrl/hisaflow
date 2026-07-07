import { apiPost } from '@/lib/api-client';

export interface ParsedAction {
  itemId: string | null;
  itemName: string;
  type: 'SALE' | 'PURCHASE' | 'WASTAGE' | 'CREATE' | 'UPDATE' | 'NOTE';
  quantity: number;
  confidence: 'HIGH' | 'LOW';
  // WASTAGE fields
  wastageReason?: string;
  // Business Specific Fields
  clientName?: string;
  metadata?: any;
  // CREATE fields
  unit?: string;
  costPrice?: number;
  sellingPrice?: number;
  reorderThreshold?: number;
  category?: string;
  // UPDATE fields
  updates?: {
    name?: string;
    unit?: string;
    costPrice?: number;
    sellingPrice?: number;
    reorderThreshold?: number;
    category?: string;
    quantity?: number;
  };
  // NOTE fields
  title?: string;
  content?: string;
  importance?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dueDate?: string;
  checklists?: { text: string }[];
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
