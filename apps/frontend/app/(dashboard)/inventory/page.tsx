'use client';

import { useState } from 'react';
import { useInventory } from '@/hooks/useInventory';
import InventoryItemCard from '@/components/system/InventoryItemCard';
import AddItemSheet from '@/components/mobile/AddItemSheet';
import EditItemSheet from '@/components/mobile/EditItemSheet';
import QuickTransactionSheet from '@/components/mobile/QuickTransactionSheet';
import { PackageOpen } from 'lucide-react';
import { useRole } from '@/hooks/useRole';
import type { InventoryItem } from '@/services/inventory.service';

export default function InventoryPage() {
  const { items, loading, error, mutate } = useInventory();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [txSheetOpen, setTxSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const { canManageInventory } = useRole();

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory</h1>
        {canManageInventory && (
          <div className="flex gap-2">
            <button
              onClick={() => setTxSheetOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg font-bold text-[var(--color-text-primary)]"
              aria-label="Log transaction"
            >
              ↕
            </button>
            <button
              onClick={() => setSheetOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent)] text-xl font-bold text-white"
              aria-label="Add item"
            >
              +
            </button>
          </div>
        )}
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
            <InventoryItemCard
              key={item.id}
              item={item}
              onEdit={canManageInventory ? (i) => setEditingItem(i) : undefined}
            />
          ))}
        </div>
      )}

      {canManageInventory && (
        <>
          <AddItemSheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            onCreated={() => mutate()}
          />
          <QuickTransactionSheet
            open={txSheetOpen}
            onClose={() => setTxSheetOpen(false)}
            onCompleted={() => mutate()}
            items={items}
          />
        </>
      )}

      {editingItem && (
        <EditItemSheet
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onUpdated={() => { mutate(); setEditingItem(null); }}
        />
      )}
    </div>
  );
}

