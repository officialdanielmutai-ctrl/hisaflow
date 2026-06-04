'use client';

import type { InventoryItem } from '@/services/inventory.service';

interface InventoryItemCardProps {
  item: InventoryItem;
}

export default function InventoryItemCard({ item }: InventoryItemCardProps) {
  const isLowStock = item.quantity <= item.reorderThreshold;

  return (
    <div className="flex items-center justify-between rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2">
        {isLowStock && (
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-red-500" />
        )}
        <div>
          <p className="text-base font-semibold">{item.name}</p>
          {item.category && (
            <p className="text-sm text-muted-foreground">{item.category}</p>
          )}
        </div>
      </div>
      <div className="text-right">
        <p className="text-2xl font-bold">{item.quantity}</p>
        <p className="text-xs text-muted-foreground">{item.unit}</p>
      </div>
    </div>
  );
}
