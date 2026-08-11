'use client';

import { Drawer } from 'vaul';
import { ScanLine, Camera } from 'lucide-react';

interface ScanModeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectBarcode: () => void;
  onSelectLabel: () => void;
}

export default function ScanModeSheet({
  open,
  onOpenChange,
  onSelectBarcode,
  onSelectLabel,
}: ScanModeSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-[32px] bg-white outline-none border border-gray-200 p-4 pb-8">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-300" />
          <Drawer.Title className="mb-4 text-center text-base font-bold">
            What do you want to scan?
          </Drawer.Title>

          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onSelectBarcode();
            }}
            className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] p-4 text-left transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-secondary)]">
              <ScanLine className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Scan Barcode</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Look up or add an item by its barcode
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onSelectLabel();
            }}
            className="mt-3 flex items-center gap-3 rounded-2xl border border-[var(--color-border)] p-4 text-left transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-secondary)]">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Scan Label / Packaging</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Photograph the product to read its name, category and expiry
              </p>
            </div>
          </button>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
