'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { useRole } from '@/hooks/useRole';

import {
  createInventoryItem,
  type CreateProductPayload,
} from '@/services/inventory.service';

interface AddItemSheetProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function AddItemSheet({
  open,
  onClose,
  onCreated,
}: AddItemSheetProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [reorderThreshold, setReorderThreshold] = useState(0);
  const [costPrice, setCostPrice] = useState<number | ''>('');
  const [sellingPrice, setSellingPrice] = useState<number | ''>('');
  const [expiryDate, setExpiryDate] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const { isStaff } = useRole();

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
        unit,
        quantity,
        reorderThreshold,
        ...(costPrice !== '' && !isStaff && { costPrice }),
        ...(sellingPrice !== '' && !isStaff && { sellingPrice }),
        ...(expiryDate && { expiryDate }),
        ...(serialNumber && { serialNumber }),
        ...(batchNumber && { batchNumber }),
      };
      await createInventoryItem(payload, token, membership!.organization.id);
      onCreated();
      onClose();
    } catch (error) {
      console.error('Failed to create item', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={onClose}
        />
      )}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-[var(--color-bg-surface)] p-6 transition-transform duration-300 ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-2xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="mb-6 text-xl font-bold">Add Product</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">Name *</label>
            <input
              type="text"
              className="w-full rounded-xl border px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">Category</label>
            <input
              type="text"
              placeholder="e.g. Beverages"
              className="w-full rounded-xl border px-3 py-2"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">Unit *</label>
            <input
              type="text"
              placeholder="e.g. pieces, kg, litres"
              className="w-full rounded-xl border px-3 py-2"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              required
            />
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">Quantity *</label>
            <input
              type="number"
              min={0}
              className="w-full rounded-xl border px-3 py-2"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
            />
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">
              Reorder threshold *
            </label>
            <input
              type="number"
              min={0}
              className="w-full rounded-xl border px-3 py-2"
              value={reorderThreshold}
              onChange={(e) => setReorderThreshold(Number(e.target.value))}
              required
            />
          </div>

          {/* Price fields — hidden from staff */}
          {!isStaff && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Cost Price (KES)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  className="w-full rounded-xl border px-3 py-2"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Selling Price (KES)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  className="w-full rounded-xl border px-3 py-2"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
            </div>
          )}

          {/* Conditional Business Fields */}
          {membership?.organization.businessType === 'CHEMIST' && (
            <>
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium">Expiry Date</label>
                <input
                  type="date"
                  className="w-full rounded-xl border px-3 py-2"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium">Batch Number</label>
                <input
                  type="text"
                  placeholder="e.g. BATCH-001"
                  className="w-full rounded-xl border px-3 py-2"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                />
              </div>
            </>
          )}

          {membership?.organization.businessType === 'ISP' && (
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium">Serial Number</label>
              <input
                type="text"
                placeholder="e.g. SN-987654321"
                className="w-full rounded-xl border px-3 py-2"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-2xl bg-[var(--color-accent)] text-white font-semibold"
          >
            {loading ? 'Adding...' : 'Add Product'}
          </button>
        </form>
      </div>
    </>
  );
}
