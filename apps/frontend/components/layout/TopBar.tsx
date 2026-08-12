'use client';

import * as React from 'react';
import { Menu, Bell, ScanLine } from 'lucide-react';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { OCR_DRAFT_STORAGE_KEY, type LabelOcrResult } from '@/hooks/useLabelOcrCapture';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAlerts } from '@/hooks/useAlerts';
import SideMenu from './SideMenu';
import BarcodeScannerSheet from '../system/BarcodeScannerSheet';
import ScanModeSheet from '../system/ScanModeSheet';
import LabelCaptureSheet from '../system/LabelCaptureSheet';

export default function TopBar() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [scanModeOpen, setScanModeOpen] = React.useState(false);
  const [scannerOpen, setScannerOpen] = React.useState(false);
  const [labelCaptureOpen, setLabelCaptureOpen] = React.useState(false);
  const { membership } = useMyOrganization();
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

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-30 flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6 text-[var(--color-text-primary)]" />
          </button>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-[var(--color-text-primary)]">
              {membership?.organization.name || 'Hisa Flow'}
            </span>
            <span className="text-xs font-medium text-[var(--color-text-muted)]">
              {membership?.organization.businessType === 'ISP'
                ? 'ISP Workspace'
                : membership?.organization.businessType === 'CHEMIST'
                ? 'Chemist Workspace'
                : 'Retail Workspace'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setScanModeOpen(true)}
            className="relative p-2 text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] rounded-full transition-colors"
            aria-label="Scan"
          >
            <ScanLine className="h-5 w-5" />
          </button>
          <Link href="/alerts" className="relative p-2 text-[var(--color-text-primary)]">
            <Bell className="h-6 w-6" />
            {(alerts ?? []).length > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                {(alerts ?? []).length}
              </span>
            )}
          </Link>
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: "h-8 w-8"
              }
            }}
          />
        </div>
      </header>

      <SideMenu open={menuOpen} onOpenChange={setMenuOpen} />
      <ScanModeSheet
        open={scanModeOpen}
        onOpenChange={setScanModeOpen}
        onSelectBarcode={() => setScannerOpen(true)}
        onSelectLabel={() => setLabelCaptureOpen(true)}
      />
      <BarcodeScannerSheet open={scannerOpen} onOpenChange={setScannerOpen} />
      <LabelCaptureSheet
        open={labelCaptureOpen}
        onOpenChange={setLabelCaptureOpen}
        onCapture={handleLabelCapture}
      />
    </>
  );
}

