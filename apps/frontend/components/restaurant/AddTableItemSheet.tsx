'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { useInventory } from '@/hooks/useInventory';
import { addTableOrderItem } from '@/services/table-orders.service';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AddTableItemSheet({
  orderId,
  children,
  onSuccess,
}: {
  orderId: string;
  children: React.ReactNode;
  onSuccess: () => void;
}) {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const { items, loading } = useInventory();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const orgId = membership?.organization.id;

  const variants = useMemo(
    () =>
      items
        .flatMap((product) =>
          product.variants.map((variant) => ({
            ...variant,
            productName: product.name,
          })),
        )
        .filter(
          (variant) =>
            !search.trim() ||
            variant.name.toLowerCase().includes(search.toLowerCase()) ||
            variant.productName.toLowerCase().includes(search.toLowerCase()),
        ),
    [items, search],
  );

  const handleSelect = (id: string) => {
    setVariantId(id);
    const selected = variants.find((variant) => variant.id === id);
    if (selected?.sellingPrice != null) {
      setUnitPrice(String(selected.sellingPrice));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !variantId) return;
    try {
      setSaving(true);
      setError('');
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await addTableOrderItem(
        orderId,
        {
          itemId: variantId,
          quantity: Number(quantity),
          unitPrice: Number(unitPrice || 0),
        },
        token,
        orgId,
      );
      setOpen(false);
      setVariantId('');
      setQuantity('1');
      setUnitPrice('');
      setSearch('');
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not add the item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="bg-[#FAFAFA] flex flex-col overflow-hidden">
        <SheetHeader>
          <SheetTitle>Add item to table</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 flex-1 space-y-4 overflow-y-auto">
          {error && <div className="text-sm text-red-500">{error}</div>}

          <div className="space-y-2">
            <Label htmlFor="table-item-search">Find a dish or drink</Label>
            <Input
              id="table-item-search"
              placeholder="Search the menu…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="table-item">Item</Label>
            <select
              id="table-item"
              value={variantId}
              onChange={(e) => handleSelect(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-3 text-sm"
              required
              disabled={loading}
            >
              <option value="">
                {loading ? 'Loading menu…' : 'Choose an item'}
              </option>
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.productName} — {variant.name} (KES{' '}
                  {Number(variant.sellingPrice ?? 0).toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="table-item-qty">Quantity</Label>
              <Input
                id="table-item-qty"
                type="number"
                min="0.001"
                step="0.001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="table-item-price">Unit price (KES)</Label>
              <Input
                id="table-item-price"
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)]/90"
            disabled={saving || !variantId}
          >
            {saving ? 'Adding…' : 'Add to table'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
