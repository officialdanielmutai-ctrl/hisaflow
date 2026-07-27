import { PackageOpen, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { Product, InventoryItem } from '@/services/inventory.service';
import { formatCurrency } from '@/lib/utils';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { useRole } from '@/hooks/useRole';

interface ProductCardProps {
  product: Product;
  onClick?: (variant: InventoryItem) => void;
}

export default function ProductCard({ product, onClick }: ProductCardProps) {
  const { membership } = useMyOrganization();
  const { isStaff } = useRole();
  const currency = membership?.organization.currency || 'KES';
  const [expanded, setExpanded] = useState(false);

  const totalQuantity = product.variants.reduce((sum, v) => sum + Number(v.quantity), 0);
  const totalVolume = product.variants.reduce((sum, v) => {
    if (v.measureValue && v.measureUnit) {
      return sum + (Number(v.measureValue) * Number(v.quantity));
    }
    return sum;
  }, 0);
  const volumeUnit = product.variants.find(v => v.measureUnit)?.measureUnit || '';

  const hasLowStock = product.variants.some(v => v.status === 'LOW' || v.status === 'OUT_OF_STOCK');

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-sm transition-all hover:shadow-md">
      <div 
        className="flex cursor-pointer items-center justify-between p-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              hasLowStock ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
            }`}
          >
            {hasLowStock ? <AlertTriangle size={18} /> : <PackageOpen size={18} />}
          </div>
          <div>
            <h3 className="font-semibold text-sm">{product.name}</h3>
            {product.category && (
              <p className="text-[10px] text-[var(--color-text-secondary)]">{product.category}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-sm font-bold">
              {totalQuantity.toLocaleString()} {totalQuantity === 1 ? 'unit' : 'units'}
            </span>
            {totalVolume > 0 && volumeUnit && (
              <span className="text-xs text-[var(--color-text-secondary)]">
                {totalVolume.toLocaleString()} {volumeUnit} total
              </span>
            )}
          </div>
          <button className="text-[var(--color-text-secondary)]">
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
      </div>

      {expanded && product.variants.length > 0 && (
        <div className="bg-[var(--color-bg-base)] p-4 border-t border-[var(--color-border)] flex flex-col gap-3">
          <div className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Variants & Packaging</div>
          {product.variants.map((variant) => (
            <div 
              key={variant.id} 
              onClick={(e) => {
                e.stopPropagation();
                onClick?.(variant);
              }}
              className="flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3 cursor-pointer hover:border-[var(--color-accent)] transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="font-medium text-sm">{variant.name}</span>
                  {variant.measureValue && variant.measureUnit && (
                    <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full text-[var(--color-text-secondary)]">
                      {variant.measureValue} {variant.measureUnit}
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end">
                  <span className={`text-sm font-bold ${
                    variant.status === 'HEALTHY' ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {Number(variant.quantity).toLocaleString()} {variant.unit}s
                  </span>
                  {!isStaff && variant.sellingPrice && (
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {formatCurrency(Number(variant.sellingPrice), currency)}
                    </span>
                  )}
                </div>
              </div>

              {variant.packaging && variant.packaging.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {variant.packaging.map((pack) => (
                    <div key={pack.id} className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-1 rounded-md flex gap-1 items-center">
                      <PackageOpen size={10} />
                      {pack.name} = {pack.quantityPerUnit} {variant.unit}s
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
