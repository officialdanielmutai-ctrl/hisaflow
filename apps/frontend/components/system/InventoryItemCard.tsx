'use client';

import { Edit2, PackagePlus } from 'lucide-react';
import type { InventoryItem } from '@/services/inventory.service';

interface InventoryItemCardProps {
  item: InventoryItem;
  onEdit?: (item: InventoryItem) => void;
  onReceiveStock?: (item: InventoryItem) => void;
}

export default function InventoryItemCard({ item, onEdit, onReceiveStock }: InventoryItemCardProps) {
  const isLowStock = item.quantity <= item.reorderThreshold;

  return (
    <div className="flex items-center justify-between rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 min-w-0">
        {isLowStock && (
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-red-500" />
        )}
        <div className="min-w-0">
          <p className="text-base font-semibold truncate">{item.name}</p>
          {item.category && (
            <p className="text-sm text-muted-foreground">{item.category}</p>
          )}
          {item.serialNumber && (
            <p className="text-xs text-muted-foreground font-mono mt-1">SN: {item.serialNumber}</p>
          )}
          {item.batchNumber && (
            <p className="text-xs text-muted-foreground font-mono">Batch: {item.batchNumber}</p>
          )}
          {item.expiryDate && (
            <p className="text-xs text-orange-600 mt-1">
              Exp: {new Date(item.expiryDate).toLocaleDateString()}
            </p>
          )}
          {(item.costPrice != null || item.sellingPrice != null) && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {item.costPrice != null ? `Cost: KES ${item.costPrice}` : ''}
              {item.costPrice != null && item.sellingPrice != null ? ' · ' : ''}
              {item.sellingPrice != null ? `Sell: KES ${item.sellingPrice}` : ''}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <div className="text-right">
          <p className="text-2xl font-bold">{item.quantity}</p>
          <p className="text-xs text-muted-foreground">{item.unit}</p>
        </div>
        {onReceiveStock && (
          <button
            onClick={() => onReceiveStock(item)}
            className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 transition-colors"
            aria-label="Receive stock"
            title="Receive stock"
          >
            <PackagePlus className="h-4 w-4" />
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(item)}
            className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
            aria-label="Edit item"
          >
            <Edit2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
