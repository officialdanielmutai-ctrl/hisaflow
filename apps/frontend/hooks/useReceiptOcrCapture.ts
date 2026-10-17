'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import imageCompression from 'browser-image-compression';
import { useMyOrganization } from './useMyOrganization';
import { ocrAndParseImage } from '@/services/ocr.service';
import type { ParsedAction } from '@/services/ai-ingestion.service';

export interface ReceiptOcrResult {
  text: string;
  actions: ParsedAction[];
}

// Shared handoff key: TopBar's global scan trigger has no direct access to the
// `/ai` page's component tree, so a receipt parse captured from there is
// stashed here and read once by AiIngestionPanel to render the batch table.
export const RECEIPT_DRAFT_STORAGE_KEY = 'hisaflow:receiptDraft';

// Same-page handoff: if the user is already on `/ai`, `router.push('/ai')` does
// not remount the panel, so TopBar also fires this event and the panel applies
// the stashed draft without waiting for a remount.
export const RECEIPT_DRAFT_EVENT = 'hisaflow:receipt-draft';

/**
 * Runs a captured receipt/list photo through the combined OCR + AI-parse
 * endpoint in RECEIPT_OCR mode. Unlike the label hook, this keeps *every*
 * parsed line so the caller can review them all in `ReceiptItemsTable`.
 */
export function useReceiptOcrCapture() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const [status, setStatus] = useState<'idle' | 'processing'>('idle');

  const processImage = useCallback(
    async (imageBlob: Blob): Promise<ReceiptOcrResult | null> => {
      if (!membership?.organization.id) return null;

      setStatus('processing');
      try {
        const token = await getToken();
        if (!token) return null;

        const compressed = await imageCompression(imageBlob as File, {
          maxSizeMB: 2,
          maxWidthOrHeight: 1600,
          initialQuality: 0.8,
          useWebWorker: true,
        });

        const { text, actions } = await ocrAndParseImage(
          compressed,
          token,
          membership.organization.id,
          'RECEIPT_OCR',
        );

        // No text or no line items means the photo was not readable; the
        // capture sheet shows a retry message rather than an empty table.
        if (!text.trim() || actions.length === 0) return null;

        return { text, actions };
      } catch (err) {
        console.error('Receipt OCR capture failed:', err);
        return null;
      } finally {
        setStatus('idle');
      }
    },
    [getToken, membership?.organization.id],
  );

  return { processImage, status };
}
