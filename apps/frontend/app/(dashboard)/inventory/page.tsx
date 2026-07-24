'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useInventory } from '@/hooks/useInventory';
import InventoryItemCard from '@/components/system/InventoryItemCard';
import AddItemSheet from '@/components/mobile/AddItemSheet';
import EditItemSheet from '@/components/mobile/EditItemSheet';
import QuickTransactionSheet from '@/components/mobile/QuickTransactionSheet';
import ReceiveStockSheet from '@/components/mobile/ReceiveStockSheet';
import { PackageOpen } from 'lucide-react';
import { useRole } from '@/hooks/useRole';
import type { InventoryItem } from '@/services/inventory.service';

export default function InventoryPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { items, loading, error, mutate } = useInventory();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [txSheetOpen, setTxSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [receivingItem, setReceivingItem] = useState<InventoryItem | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'LOW_STOCK'>(
    searchParams.get('filter') === 'LOW_STOCK' ? 'LOW_STOCK' : 'ALL'
  );
  const { canAddInventory, canEditInventory, isStaff } = useRole();

  const displayedItems = filter === 'LOW_STOCK' 
    ? items.filter((i) => i.quantity <= i.reorderThreshold && i.reorderThreshold > 0) 
    : items;

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setSheetOpen(true);
    }
  }, [searchParams]);

  const handleCloseSheet = () => {
    setSheetOpen(false);
    if (searchParams.get('action') === 'add') {
      router.replace('/inventory');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <div className="flex gap-2">
          {/* Quick transaction — owners/managers only */}
          {canEditInventory && (
            <button
              onClick={() => setTxSheetOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg font-bold text-[var(--color-text-primary)]"
              aria-label="Log transaction"
            >
              ↕
            </button>
          )}
          {/* Add item — all roles */}
          {canAddInventory && (
            <button
              onClick={() => setSheetOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent)] text-xl font-bold text-white"
              aria-label="Add item"
            >
              +
            </button>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <button
          onClick={() => setFilter('ALL')}
          className={`flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
            filter === 'ALL'
              ? 'bg-[var(--color-accent)] text-white'
              : 'bg-muted text-[var(--color-text-secondary)]'
          }`}
        >
          All Items
        </button>
        <button
          onClick={() => setFilter('LOW_STOCK')}
          className={`flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
            filter === 'LOW_STOCK'
              ? 'bg-[var(--color-accent)] text-white'
              : 'bg-muted text-[var(--color-text-secondary)]'
          }`}
        >
          Low Stock
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
      {!loading && !error && displayedItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <PackageOpen className="mb-4 h-12 w-12 text-[var(--color-text-muted)]" />
          <p className="text-base font-semibold text-[var(--color-text-primary)]">
            {filter === 'LOW_STOCK' ? 'No low stock items' : 'No items yet'}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {filter === 'LOW_STOCK' ? 'All items are well stocked' : 'Add your first product'}
          </p>
        </div>
      )}

      {/* Items list */}
      {!loading && !error && displayedItems.length > 0 && (
        <div className="flex flex-col gap-3">
          {displayedItems.map((item) => (
            <InventoryItemCard
              key={item.id}
              item={item}
              onEdit={canEditInventory ? (i) => setEditingItem(i) : undefined}
              onReceiveStock={isStaff ? (i) => setReceivingItem(i) : undefined}
            />
          ))}
        </div>
      )}

      {/* Add item sheet — all roles */}
      {canAddInventory && (
        <AddItemSheet
          open={sheetOpen}
          onClose={handleCloseSheet}
          onCreated={() => mutate()}
        />
      )}

      {/* Quick transaction + Edit sheet — owners/managers only */}
      {canEditInventory && (
        <>
          <QuickTransactionSheet
            open={txSheetOpen}
            onClose={() => setTxSheetOpen(false)}
            onCompleted={() => mutate()}
            items={items}
          />
        </>
      )}

      {editingItem && canEditInventory && (
        <EditItemSheet
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onUpdated={() => { mutate(); setEditingItem(null); }}
        />
      )}

      {/* Receive stock sheet — staff only */}
      <ReceiveStockSheet
        item={receivingItem}
        onClose={() => setReceivingItem(null)}
        onCompleted={() => mutate()}
      />
    </div>
  );
}

