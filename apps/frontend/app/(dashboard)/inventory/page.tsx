'use client';

import { useInventory } from '@/hooks/useInventory';
import InventoryItemCard from '@/components/system/InventoryItemCard';
import { PackageOpen } from 'lucide-react';

export default function InventoryPage() {
  const { items, loading, error } = useInventory();

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <button
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent)] text-xl font-bold text-white"
          aria-label="Add item"
        >
          +
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-20 w-full animate-pulse rounded-2xl bg-muted"
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="py-12 text-center text-[var(--color-text-secondary)]">
          Failed to load inventory
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <PackageOpen className="mb-4 h-12 w-12 text-[var(--color-text-muted)]" />
          <p className="text-base font-semibold text-[var(--color-text-primary)]">
            No items yet
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Add your first product
          </p>
        </div>
      )}

      {/* Items list */}
      {!loading && !error && items.length > 0 && (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <InventoryItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
