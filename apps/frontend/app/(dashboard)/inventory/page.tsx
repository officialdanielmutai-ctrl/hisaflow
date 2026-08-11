'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useInventory } from '@/hooks/useInventory';
import ProductCard from '@/components/system/ProductCard';
import AddItemSheet from '@/components/mobile/AddItemSheet';
import EditItemSheet from '@/components/mobile/EditItemSheet';
import QuickTransactionSheet from '@/components/mobile/QuickTransactionSheet';
import ReceiveStockSheet from '@/components/mobile/ReceiveStockSheet';
import { PackageOpen } from 'lucide-react';
import { useRole } from '@/hooks/useRole';
import type { InventoryItem } from '@/services/inventory.service';
import { OCR_DRAFT_STORAGE_KEY, type LabelOcrResult } from '@/hooks/useLabelOcrCapture';

export default function InventoryPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { items, loading, error, mutate } = useInventory(); // items is now Product[]
  const [sheetOpen, setSheetOpen] = useState(false);
  const [txSheetOpen, setTxSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [receivingItem, setReceivingItem] = useState<InventoryItem | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [ocrDraft, setOcrDraft] = useState<LabelOcrResult | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'LOW_STOCK'>(
    searchParams.get('filter') === 'LOW_STOCK' ? 'LOW_STOCK' : 'ALL'
  );
  const { canAddInventory, canEditInventory, isStaff } = useRole();

  const scannedBarcode = searchParams.get('action') === 'add' ? searchParams.get('barcode') : null;

  // Low stock check now looks inside variants
  const displayedItems = filter === 'LOW_STOCK' 
    ? items.filter((p) => p.variants.some((v) => Number(v.quantity) <= Number(v.reorderThreshold) && Number(v.reorderThreshold) > 0)) 
    : items;

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setSheetOpen(true);
    }
  }, [searchParams]);

  // Handles the redirect from TopBar's "Scan Label" flow (see
  // useLabelOcrCapture): the result was stashed in sessionStorage since
  // TopBar has no direct access to this page's component tree. Read it
  // once, hand it to AddItemSheet, then clear it so a page refresh
  // doesn't re-apply a stale draft.
  useEffect(() => {
    if (searchParams.get('fromOcr') !== '1') return;

    try {
      const raw = sessionStorage.getItem(OCR_DRAFT_STORAGE_KEY);
      if (raw) {
        setOcrDraft(JSON.parse(raw));
      }
      sessionStorage.removeItem(OCR_DRAFT_STORAGE_KEY);
    } catch (error) {
      console.error('Could not read OCR draft:', error);
    }
    router.replace('/inventory?action=add');
  }, [searchParams, router]);

  // Handles the redirect from the barcode scanner (see BarcodeScannerSheet).
  // A matched item lands here as `?scannedItemId=<variantId>`; we look it up
  // in the already-loaded inventory list so EditItemSheet gets a fully
  // populated item (packaging included) rather than a partial API response.
  useEffect(() => {
    const scannedItemId = searchParams.get('scannedItemId');
    if (!scannedItemId || loading) return;

    const matchedVariant = items
      .flatMap((product) => product.variants)
      .find((variant) => variant.id === scannedItemId);

    if (matchedVariant) {
      setEditingItem(matchedVariant);
    } else {
      setScanNotice('Scanned item could not be found. It may have been removed.');
    }
    router.replace('/inventory');
  }, [searchParams, items, loading, router]);

  const handleCloseSheet = () => {
    setSheetOpen(false);
    setOcrDraft(null);
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
          {canEditInventory && (
            <button
              onClick={() => setTxSheetOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg font-bold text-[var(--color-text-primary)]"
              aria-label="Log transaction"
            >
              ↕
            </button>
          )}
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

      {loading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[72px] w-full animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {scanNotice && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          <span>{scanNotice}</span>
          <button
            onClick={() => setScanNotice(null)}
            className="shrink-0 font-medium text-amber-700 hover:text-amber-900"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {!loading && !error && displayedItems.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] py-12 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            <PackageOpen className="h-8 w-8 text-[var(--color-text-secondary)]" />
          </div>
          <h3 className="mb-1 font-semibold text-[var(--color-text-primary)]">
            No items found
          </h3>
          <p className="max-w-[200px] text-sm text-[var(--color-text-secondary)]">
            {filter === 'LOW_STOCK'
              ? 'All your stock levels are healthy.'
              : 'Start building your inventory to track your stock.'}
          </p>
        </div>
      )}

      {!loading && !error && displayedItems.length > 0 && (
        <div className="flex flex-col gap-3">
          {displayedItems.map((product) => (
            <ProductCard 
              key={product.id} 
              product={product} 
              onClick={(variant) => setEditingItem(variant)}
            />
          ))}
        </div>
      )}

      {/* Sheets */}
      <AddItemSheet
        open={sheetOpen}
        initialBarcode={scannedBarcode || undefined}
        initialOcrDraft={ocrDraft || undefined}
        onOpenChange={(open) => {
          if (!open) handleCloseSheet();
          else setSheetOpen(true);
        }}
        onSuccess={() => mutate()}
      />

      <EditItemSheet
        item={editingItem}
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
        onSuccess={() => {
          setEditingItem(null);
          mutate();
        }}
      />

      <QuickTransactionSheet
        open={txSheetOpen}
        onOpenChange={setTxSheetOpen}
        onSuccess={() => mutate()}
      />

      <ReceiveStockSheet
        item={receivingItem}
        open={!!receivingItem}
        onOpenChange={(open) => !open && setReceivingItem(null)}
        onSuccess={() => {
          setReceivingItem(null);
          mutate();
        }}
      />
    </div>
  );
}
