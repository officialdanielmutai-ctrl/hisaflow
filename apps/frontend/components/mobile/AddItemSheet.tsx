'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { useRole } from '@/hooks/useRole';
import { Plus, Trash2, PackageOpen } from 'lucide-react';

import {
  createInventoryItem,
  type CreateProductPayload,
} from '@/services/inventory.service';

interface UIVariant {
  name: string;
  unit: string;
  measureValue?: number;
  measureUnit?: string;
  inputQuantity: number;
  inputUnitIndex: number;
  reorderThreshold: number;
  costPrice?: number;
  sellingPrice?: number;
  barcode?: string;
  packaging: {
    name: string;
    containsQty: number;
  }[];
}

interface AddItemSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** Pre-fills the first variant's barcode, e.g. when arriving from a barcode scan that found no match. */
  initialBarcode?: string;
}

export default function AddItemSheet({
  open,
  onOpenChange,
  onSuccess,
  initialBarcode,
}: AddItemSheetProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  
  const [variants, setVariants] = useState<UIVariant[]>([{
    name: '',
    unit: 'can',
    measureValue: undefined,
    measureUnit: '',
    inputQuantity: 0,
    inputUnitIndex: 0,
    reorderThreshold: 10,
    costPrice: undefined,
    sellingPrice: undefined,
    barcode: undefined,
    packaging: []
  }]);

  // When the sheet opens with a scanned barcode, attach it to the first variant.
  useEffect(() => {
    if (open && initialBarcode) {
      setVariants((prev) => {
        if (prev.length === 0) return prev;
        const [first, ...rest] = prev;
        return [{ ...first, barcode: initialBarcode }, ...rest];
      });
    }
  }, [open, initialBarcode]);

  const [loading, setLoading] = useState(false);
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const { isStaff } = useRole();

  const handleAddVariant = () => {
    setVariants([...variants, {
      name: '',
      unit: 'can',
      measureValue: undefined,
      measureUnit: '',
      inputQuantity: 0,
      inputUnitIndex: 0,
      reorderThreshold: 10,
      packaging: []
    }]);
  };

  const handleRemoveVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleUpdateVariant = (index: number, field: string, value: any) => {
    const newVariants = [...variants];
    (newVariants[index] as any)[field] = value;
    setVariants(newVariants);
  };

  const handleAddPackaging = (variantIndex: number) => {
    const newVariants = [...variants];
    if (!newVariants[variantIndex].packaging) {
      newVariants[variantIndex].packaging = [];
    }
    newVariants[variantIndex].packaging.push({
      name: '',
      containsQty: 1,
    });
    setVariants(newVariants);
  };

  const handleUpdatePackaging = (variantIndex: number, packIndex: number, field: keyof UIVariant['packaging'][0], value: any) => {
    const newVariants = [...variants];
    (newVariants[variantIndex].packaging[packIndex] as any)[field] = value;
    setVariants(newVariants);
  };

  const handleRemovePackaging = (variantIndex: number, packIndex: number) => {
    const newVariants = [...variants];
    newVariants[variantIndex].packaging = newVariants[variantIndex].packaging.filter((_, i) => i !== packIndex);
    // Reset inputUnitIndex if it was pointing to a removed package
    if (newVariants[variantIndex].inputUnitIndex > newVariants[variantIndex].packaging.length) {
      newVariants[variantIndex].inputUnitIndex = newVariants[variantIndex].packaging.length;
    }
    setVariants(newVariants);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!membership?.organization.id) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      
      const payload: CreateProductPayload = {
        name,
        category: category || undefined,
        description: description || undefined,
        variants: variants.map(v => {
          const absoluteMultipliers = [1];
          let currentMultiplier = 1;
          const mappedPackaging = v.packaging.map(p => {
             currentMultiplier *= p.containsQty;
             absoluteMultipliers.push(currentMultiplier);
             return { name: p.name, quantityPerUnit: currentMultiplier };
          });

          const selectedMultiplier = absoluteMultipliers[v.inputUnitIndex] || 1;
          const absoluteQuantity = v.inputQuantity * selectedMultiplier;

          return {
            name: v.name,
            unit: v.unit,
            measureValue: v.measureValue,
            measureUnit: v.measureUnit,
            quantity: absoluteQuantity,
            reorderThreshold: v.reorderThreshold,
            costPrice: isStaff ? undefined : v.costPrice,
            sellingPrice: isStaff ? undefined : v.sellingPrice,
            barcode: v.barcode || undefined,
            packaging: mappedPackaging
          };
        })
      };
      
      await createInventoryItem(payload, token, membership.organization.id);
      
      // Reset form
      setName('');
      setCategory('');
      setDescription('');
      setVariants([{ name: '', unit: 'can', inputQuantity: 0, inputUnitIndex: 0, reorderThreshold: 10, barcode: undefined, packaging: [] }]);
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create item', error);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={() => onOpenChange(false)} />
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-[var(--color-bg-surface)] p-6 shadow-xl">
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 text-2xl leading-none text-gray-500 hover:text-black"
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="mb-6 text-xl font-bold">Add Product</h2>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Product Basic Info */}
          <div className="flex flex-col gap-4 p-4 bg-[var(--color-bg-base)] rounded-2xl border border-[var(--color-border)]">
            <h3 className="font-semibold text-sm text-[var(--color-text-secondary)] uppercase tracking-wider">Product Info</h3>
            
            <div>
              <label className="mb-1 block text-sm font-medium">Name * (e.g. Margarine)</label>
              <input
                type="text"
                className="w-full rounded-xl border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Category</label>
              <input
                type="text"
                className="w-full rounded-xl border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
          </div>

          {/* Variants */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-[var(--color-text-secondary)] uppercase tracking-wider">Variants</h3>
            </div>
            
            {variants.map((variant, vIdx) => (
              <div key={vIdx} className="p-4 bg-[var(--color-bg-base)] rounded-2xl border border-[var(--color-border)] relative">
                {variants.length > 1 && (
                  <button type="button" onClick={() => handleRemoveVariant(vIdx)} className="absolute right-4 top-4 text-rose-500">
                    <Trash2 size={16} />
                  </button>
                )}
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-medium">Variant Name * (e.g. 1kg Can)</label>
                    <input
                      type="text"
                      required
                      className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-sm"
                      value={variant.name}
                      onChange={(e) => handleUpdateVariant(vIdx, 'name', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Base Unit *</label>
                    <input
                      type="text"
                      required
                      placeholder="can, piece, bottle"
                      className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-sm"
                      value={variant.unit}
                      onChange={(e) => handleUpdateVariant(vIdx, 'unit', e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="mb-1 block text-xs font-medium">Starting Qty</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-sm"
                        value={variant.inputQuantity}
                        onChange={(e) => handleUpdateVariant(vIdx, 'inputQuantity', Number(e.target.value))}
                      />
                      <select 
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] px-2 py-1.5 text-sm text-[var(--color-text-secondary)] w-32"
                        value={variant.inputUnitIndex}
                        onChange={(e) => handleUpdateVariant(vIdx, 'inputUnitIndex', Number(e.target.value))}
                      >
                        <option value={0}>{variant.unit ? variant.unit + 's' : 'Units'}</option>
                        {variant.packaging.map((p, i) => (
                          <option key={i} value={i + 1}>{p.name ? p.name + 's' : `Pack ${i+1}`}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Measure Val (e.g. 1)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-sm"
                      value={variant.measureValue || ''}
                      onChange={(e) => handleUpdateVariant(vIdx, 'measureValue', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Measure Unit (e.g. kg)</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-sm"
                      value={variant.measureUnit || ''}
                      onChange={(e) => handleUpdateVariant(vIdx, 'measureUnit', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-medium">
                      Barcode {vIdx === 0 && initialBarcode ? '(from scan)' : '(optional)'}
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-sm"
                      value={variant.barcode || ''}
                      onChange={(e) => handleUpdateVariant(vIdx, 'barcode', e.target.value)}
                    />
                  </div>
                  
                  {!isStaff && (
                    <>
                      <div>
                        <label className="mb-1 block text-xs font-medium">Cost Price</label>
                        <input
                          type="number"
                          className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-sm"
                          value={variant.costPrice || ''}
                          onChange={(e) => handleUpdateVariant(vIdx, 'costPrice', Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium">Selling Price</label>
                        <input
                          type="number"
                          className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-sm"
                          value={variant.sellingPrice || ''}
                          onChange={(e) => handleUpdateVariant(vIdx, 'sellingPrice', Number(e.target.value))}
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Packaging for this variant */}
                <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-[var(--color-text-secondary)]">Packaging Units (Optional)</span>
                    <button type="button" onClick={() => handleAddPackaging(vIdx)} className="text-xs text-[var(--color-accent)] font-medium flex items-center gap-1">
                      <Plus size={12} /> Add Packaging
                    </button>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    {variant.packaging?.map((pack, pIdx) => (
                      <div key={pIdx} className="flex items-center gap-2 bg-[var(--color-bg-surface)] p-2 rounded-xl border border-[var(--color-border)]">
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="Name (e.g. Box)"
                            required
                            className="w-full rounded-lg bg-transparent px-2 py-1 text-xs border-b border-[var(--color-border)] mb-1"
                            value={pack.name}
                            onChange={(e) => handleUpdatePackaging(vIdx, pIdx, 'name', e.target.value)}
                          />
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-500">Contains</span>
                            <input
                              type="number"
                              min="1"
                              required
                              className="w-16 rounded-md bg-transparent px-1 py-0.5 border border-[var(--color-border)]"
                              value={pack.containsQty}
                              onChange={(e) => handleUpdatePackaging(vIdx, pIdx, 'containsQty', Number(e.target.value))}
                            />
                            <span className="text-gray-500 truncate max-w-[80px]">
                              {pIdx === 0 ? (variant.unit || 'unit') : (variant.packaging[pIdx - 1].name || 'unit')}s
                            </span>
                          </div>
                        </div>
                        <button type="button" onClick={() => handleRemovePackaging(vIdx, pIdx)} className="p-2 text-rose-500">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            
            <button
              type="button"
              onClick={handleAddVariant}
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-border)] py-3 text-sm font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
            >
              <Plus size={16} /> Add Another Variant
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full rounded-xl bg-[var(--color-accent)] py-3.5 font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Product'}
          </button>
        </form>
      </div>
    </>
  );
}
