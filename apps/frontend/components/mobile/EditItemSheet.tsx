'use client';

import { useState } from 'react';
import { X, Trash2, Plus } from 'lucide-react';
import type { InventoryItem } from '@/services/inventory.service';
import { apiPatch } from '@/lib/api-client';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { useRole } from '@/hooks/useRole';

interface EditItemSheetProps {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function EditItemSheet({ item, open, onOpenChange, onSuccess }: EditItemSheetProps) {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const { isStaff } = useRole();

  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [measureValue, setMeasureValue] = useState('');
  const [measureUnit, setMeasureUnit] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reorderThreshold, setReorderThreshold] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');

  const [packaging, setPackaging] = useState<{name: string, containsQty: number}[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when item changes
  if (item && !name && !unit && quantity === '') {
    setName(item.name);
    setUnit(item.unit);
    setMeasureValue(item.measureValue != null ? String(item.measureValue) : '');
    setMeasureUnit(item.measureUnit || '');
    setQuantity(String(item.quantity));
    setReorderThreshold(String(item.reorderThreshold));
    setCostPrice(item.costPrice != null ? String(item.costPrice) : '');
    setSellingPrice(item.sellingPrice != null ? String(item.sellingPrice) : '');
    
    if (item.packaging && item.packaging.length > 0) {
      const sortedPacks = [...item.packaging].sort((a, b) => a.quantityPerUnit - b.quantityPerUnit);
      let prevQty = 1;
      const uiPacks = sortedPacks.map(p => {
        const containsQty = p.quantityPerUnit / prevQty;
        prevQty = p.quantityPerUnit;
        return { name: p.name, containsQty };
      });
      setPackaging(uiPacks);
    } else {
      setPackaging([]);
    }
  }

  if (!open || !item) return null;

  const handleClose = () => {
    setName('');
    setUnit('');
    setMeasureValue('');
    setMeasureUnit('');
    setQuantity('');
    setReorderThreshold('');
    setCostPrice('');
    setSellingPrice('');
    setPackaging([]);
    setError(null);
    onOpenChange(false);
  };

  const handleAddPackaging = () => {
    setPackaging([...packaging, { name: '', containsQty: 1 }]);
  };

  const handleUpdatePackaging = (index: number, field: 'name' | 'containsQty', value: any) => {
    const newPack = [...packaging];
    newPack[index][field] = value as never;
    setPackaging(newPack);
  };

  const handleRemovePackaging = (index: number) => {
    setPackaging(packaging.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const orgId = membership?.organization.id;
    if (!orgId) return;

    setSaving(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const payload: any = {
        name: name.trim(),
        unit: unit.trim(),
        quantity: parseFloat(quantity),
        reorderThreshold: parseFloat(reorderThreshold),
      };
      
      if (measureValue !== '') payload.measureValue = parseFloat(measureValue);
      if (measureUnit.trim() !== '') payload.measureUnit = measureUnit.trim();
      
      let currentMultiplier = 1;
      payload.packaging = packaging.map(p => {
        currentMultiplier *= p.containsQty;
        return { name: p.name.trim(), quantityPerUnit: currentMultiplier };
      });
      
      if (!isStaff) {
        if (costPrice !== '') payload.costPrice = parseFloat(costPrice);
        if (sellingPrice !== '') payload.sellingPrice = parseFloat(sellingPrice);
      }

      // Variants are updated via a dedicated endpoint: PATCH /inventory/variants/:variantId
      await apiPatch(`/inventory/variants/${item.id}`, token, orgId, payload);
      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update item.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="flex h-full w-full max-w-md flex-col bg-[var(--color-bg-base)] shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div>
            <h2 className="text-xl font-bold">Edit Variant</h2>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{item.name}</p>
          </div>
          <button onClick={handleClose} className="rounded-full p-2 hover:bg-[var(--color-bg-surface)] transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form id="edit-item-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}

            <div>
              <label className="mb-1.5 block text-sm font-semibold">Variant Name *</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Unit</label>
                <input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="can, bottle, piece..."
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Measure Val (e.g. 500)</label>
                <input
                  type="number"
                  step="0.01"
                  value={measureValue}
                  onChange={(e) => setMeasureValue(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Measure Unit (e.g. ml)</label>
                <input
                  value={measureUnit}
                  onChange={(e) => setMeasureUnit(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>
            </div>

            {/* Pricing — hidden from staff */}
            {!isStaff && (
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
                <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-3">Pricing</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold">Cost Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold">Selling Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                    />
                  </div>
                </div>
                {costPrice && sellingPrice && parseFloat(sellingPrice) > parseFloat(costPrice) && (
                  <p className="mt-2 text-xs text-emerald-600 font-medium">
                    Margin: {(((parseFloat(sellingPrice) - parseFloat(costPrice)) / parseFloat(sellingPrice)) * 100).toFixed(1)}%
                    · Profit: {(parseFloat(sellingPrice) - parseFloat(costPrice)).toFixed(2)} per {unit || 'unit'}
                  </p>
                )}
                {costPrice && sellingPrice && parseFloat(sellingPrice) <= parseFloat(costPrice) && parseFloat(sellingPrice) > 0 && (
                  <p className="mt-2 text-xs text-red-500 font-medium">⚠ Selling price should be higher than cost price</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Current Quantity</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Reorder At</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={reorderThreshold}
                  onChange={(e) => setReorderThreshold(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>
            </div>

            {/* Packaging for this variant */}
            <div className="mt-2 pt-4 border-t border-[var(--color-border)]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold">Packaging Units (Optional)</span>
                <button type="button" onClick={handleAddPackaging} className="text-xs text-[var(--color-accent)] font-medium flex items-center gap-1">
                  <Plus size={12} /> Add Packaging
                </button>
              </div>
              
              <div className="flex flex-col gap-2">
                {packaging.map((pack, pIdx) => (
                  <div key={pIdx} className="flex items-center gap-2 bg-[var(--color-bg-base)] p-2 rounded-xl border border-[var(--color-border)]">
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Name (e.g. Box)"
                        required
                        className="w-full rounded-lg bg-transparent px-2 py-1 text-sm border-b border-[var(--color-border)] mb-1"
                        value={pack.name}
                        onChange={(e) => handleUpdatePackaging(pIdx, 'name', e.target.value)}
                      />
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500">Contains</span>
                        <input
                          type="number"
                          min="1"
                          required
                          className="w-16 rounded-md bg-transparent px-1 py-0.5 border border-[var(--color-border)]"
                          value={pack.containsQty}
                          onChange={(e) => handleUpdatePackaging(pIdx, 'containsQty', Number(e.target.value))}
                        />
                        <span className="text-gray-500 truncate max-w-[80px]">
                          {pIdx === 0 ? (unit || 'unit') : (packaging[pIdx - 1].name || 'unit')}s
                        </span>
                      </div>
                    </div>
                    <button type="button" onClick={() => handleRemovePackaging(pIdx)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--color-border)] p-6 bg-[var(--color-bg-surface)]">
          <button
            type="submit"
            form="edit-item-form"
            disabled={saving || !name.trim()}
            className="w-full rounded-2xl bg-[var(--color-accent)] py-3.5 font-bold text-white shadow-md disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
