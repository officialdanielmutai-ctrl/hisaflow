import { apiGet, apiPost } from '@/lib/api-client';

export interface TieredPriceRule {
  id?: string;
  inventoryItemId?: string;
  minQuantity: number;
  pricePerUnit: number;
  label?: string | null;
}

export function getTieredPricing(
  itemId: string,
  token: string,
  organizationId: string,
): Promise<TieredPriceRule[]> {
  return apiGet<TieredPriceRule[]>(
    `/tiered-pricing/${itemId}`,
    token,
    organizationId,
  );
}

export function saveTieredPricing(
  itemId: string,
  rules: Pick<TieredPriceRule, 'minQuantity' | 'pricePerUnit' | 'label'>[],
  token: string,
  organizationId: string,
): Promise<TieredPriceRule[]> {
  // The backend accepts the rule array as the request body (not wrapped).
  return apiPost<TieredPriceRule[]>(
    `/tiered-pricing/${itemId}`,
    token,
    organizationId,
    rules,
  );
}
