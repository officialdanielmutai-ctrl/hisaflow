'use client';

import * as React from 'react';
import { Menu, Bell, ScanLine } from 'lucide-react';
import { OCR_DRAFT_STORAGE_KEY, type LabelOcrResult } from '@/hooks/useLabelOcrCapture';
import { RECEIPT_DRAFT_STORAGE_KEY, RECEIPT_DRAFT_EVENT, type ReceiptOcrResult } from '@/hooks/useReceiptOcrCapture';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAlerts } from '@/hooks/useAlerts';
import SideMenu from './SideMenu';
import BarcodeScannerSheet from '../system/BarcodeScannerSheet';
import ScanModeSheet from '../system/ScanModeSheet';
import LabelCaptureSheet from '../system/LabelCaptureSheet';
import ReceiptCaptureSheet from '../system/ReceiptCaptureSheet';
import { OrgSwitcher } from './OrgSwitcher';
import DateRangePicker from '../system/DateRangePicker';

export default function TopBar() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [scanModeOpen, setScanModeOpen] = React.useState(false);
  const [scannerOpen, setScannerOpen] = React.useState(false);
  const [labelCaptureOpen, setLabelCaptureOpen] = React.useState(false);
  const [receiptCaptureOpen, setReceiptCaptureOpen] = React.useState(false);
  const { data: alerts } = useAlerts();
  const router = useRouter();

  const handleLabelCapture = (result: LabelOcrResult) => {
    try {
      sessionStorage.setItem(OCR_DRAFT_STORAGE_KEY, JSON.stringify(result));
    } catch (error) {
      console.error('Could not stash OCR draft:', error);
      return;
    }
    router.push('/inventory?action=add&fromOcr=1');
  };

  // A receipt/list parse is handed to the /ai page's review table, which owns
  // the batch-commit path. Stash it (TopBar cannot reach that page's tree) and
  // clear it on read so a refresh cannot re-apply a stale draft.
  const handleReceiptCapture = (result: ReceiptOcrResult) => {
    try {
      sessionStorage.setItem(RECEIPT_DRAFT_STORAGE_KEY, JSON.stringify(result));
    } catch (error) {
      console.error('Could not stash receipt draft:', error);
      return;
    }
    // The panel may already be mounted on `/ai`; notify it directly and let the
    // route push no-op in that case.
    window.dispatchEvent(new Event(RECEIPT_DRAFT_EVENT));
    router.push('/ai');
  };

  return (
    <>
      <header className="fixed top-0 inset-x-0 lg:left-16 z-30 flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 sm:px-6 transition-[left] duration-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(true)}
            className="lg:hidden flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6 text-[var(--color-text-primary)]" />
          </button>
          <OrgSwitcher />
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <DateRangePicker />
          <button
            onClick={() => setScanModeOpen(true)}
            className="relative p-2 text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] rounded-full transition-colors"
            aria-label="Scan"
          >
            <ScanLine className="h-5 w-5" />
          </button>
          <Link href="/alerts" className="relative p-2 text-[var(--color-text-primary)]" aria-label="Alerts">
            <Bell className="h-6 w-6" />
            {(alerts ?? []).length > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                {(alerts ?? []).length}
              </span>
            )}
          </Link>
          <div className="lg:hidden">
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox: "h-8 w-8"
                }
              }}
            />
          </div>
        </div>
      </header>

      <SideMenu open={menuOpen} onOpenChange={setMenuOpen} />
      <ScanModeSheet
        open={scanModeOpen}
        onOpenChange={setScanModeOpen}
        onSelectBarcode={() => setScannerOpen(true)}
        onSelectLabel={() => setLabelCaptureOpen(true)}
        onSelectReceipt={() => setReceiptCaptureOpen(true)}
      />
      <BarcodeScannerSheet open={scannerOpen} onOpenChange={setScannerOpen} />
      <LabelCaptureSheet
        open={labelCaptureOpen}
        onOpenChange={setLabelCaptureOpen}
        onCapture={handleLabelCapture}
      />
      <ReceiptCaptureSheet
        open={receiptCaptureOpen}
        onOpenChange={setReceiptCaptureOpen}
        onCapture={handleReceiptCapture}
      />
    </>
  );
}

