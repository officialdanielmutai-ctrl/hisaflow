'use client';

import { useLabelOcrCapture, type LabelOcrResult } from '@/hooks/useLabelOcrCapture';
import { ScanCaptureSheet } from './ScanCaptureSheet';

interface LabelCaptureSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (result: LabelOcrResult) => void;
}

/**
 * Product-label capture. The camera surface lives in `ScanCaptureSheet`; this
 * wrapper just wires the label OCR hook and its copy.
 */
export default function LabelCaptureSheet({
  open,
  onOpenChange,
  onCapture,
}: LabelCaptureSheetProps) {
  const { processImage, status } = useLabelOcrCapture();

  return (
    <ScanCaptureSheet<LabelOcrResult>
      open={open}
      onOpenChange={onOpenChange}
      title="Scan Label"
      processing={status === 'processing'}
      process={processImage}
      onCapture={onCapture}
      notFoundMessage="Couldn't read any details from that photo — try getting closer to the product name, or enter details manually."
      idleHint="Point the camera at the packaging or label, then tap the shutter."
      processingHint="Reading the label… this can take a few seconds."
    />
  );
}
