'use client';

import { useReceiptOcrCapture, type ReceiptOcrResult } from '@/hooks/useReceiptOcrCapture';
import { ScanCaptureSheet } from './ScanCaptureSheet';

interface ReceiptCaptureSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (result: ReceiptOcrResult) => void;
}

/**
 * Receipt / list capture. Unlike the single-product label scan, this keeps
 * every parsed line so the caller can show the batch review table.
 */
export default function ReceiptCaptureSheet({
  open,
  onOpenChange,
  onCapture,
}: ReceiptCaptureSheetProps) {
  const { processImage, status } = useReceiptOcrCapture();

  return (
    <ScanCaptureSheet<ReceiptOcrResult>
      open={open}
      onOpenChange={onOpenChange}
      title="Scan List / Receipt"
      processing={status === 'processing'}
      process={processImage}
      onCapture={onCapture}
      notFoundMessage="Couldn't read any items from that photo — try better lighting, hold the camera steady, and make sure the whole list is in frame."
      idleHint="Point the camera at the receipt or list, then tap the shutter."
      processingHint="Reading the list… this can take a few seconds."
    />
  );
}
