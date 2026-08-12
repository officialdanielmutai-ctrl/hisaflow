'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import imageCompression from 'browser-image-compression';
import { useMyOrganization } from './useMyOrganization';
import { parseInventoryText } from '@/services/ai-ingestion.service';

export interface LabelOcrResult {
  name: string | null;
  category: string | null;
  unit: string | null;
  expiryDate: string | null;
  batchNumber: string | null;
}

// Shared handoff key: TopBar's global scan trigger has no direct access to
// the inventory page's component tree, so a label-OCR result captured from
// there is stashed here and read once by app/(dashboard)/inventory/page.tsx
// when it loads with ?fromOcr=1.
export const OCR_DRAFT_STORAGE_KEY = 'hisaflow:ocrDraft';

/**
 * The AI extracts expiry dates "as printed" (e.g. "12/2027", "Dec 2027",
 * "2027-12-31"), which isn't guaranteed to be a value <input type="date">
 * or the backend's `new Date(...)` call can safely handle. This attempts
 * a best-effort parse and returns a YYYY-MM-DD string only if it produces
 * a genuinely valid date; otherwise null, so an unparseable date is
 * silently dropped rather than risking a bad value reaching the backend.
 */
function normalizeDateForInput(raw: unknown): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  if (year < 2000 || year > 2100) return null;
  return parsed.toISOString().split('T')[0];
}

/**
 * Runs a captured product-label photo through the existing receipt-OCR
 * text extraction endpoint, then through the AI ingestion parser
 * (LABEL_OCR mode) to pull out structured product details.
 *
 * Deliberately does NOT use `<input type="file" capture="environment">`
 * to trigger the OS camera app: handing off to a separate native camera
 * app and back is unreliable inside an installed PWA - iOS in particular
 * will often fully reload the page on return to free memory, which wipes
 * all JS state (including this capture) and drops the user back at the
 * app's start URL. Capture happens in-page instead (see LabelCaptureSheet,
 * which uses the same getUserMedia approach as BarcodeScannerSheet), so
 * the browser never actually leaves the app.
 */
export function useLabelOcrCapture() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const [status, setStatus] = useState<'idle' | 'processing'>('idle');

  const processImage = useCallback(
    async (imageBlob: Blob): Promise<LabelOcrResult | null> => {
      if (!membership?.organization.id) return null;

      setStatus('processing');
      try {
        const token = await getToken();
        if (!token) return null;

        const compressed = await imageCompression(imageBlob as File, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        });

        const formData = new FormData();
        formData.append('image', compressed, 'label.jpg');

        const ocrRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/ocr/receipt`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'x-organization-id': membership.organization.id,
            },
            body: formData,
          },
        );

        if (!ocrRes.ok) return null;

        const { text } = await ocrRes.json();
        if (!text?.trim()) return null;

        const actions = await parseInventoryText(
          text,
          token,
          membership.organization.id,
          'LABEL_OCR',
        );
        const createAction = actions.find((a) => a.type === 'CREATE');
        if (!createAction) return null;

        return {
          name: createAction.itemName || null,
          category: createAction.category || null,
          unit: createAction.unit || null,
          expiryDate: normalizeDateForInput(createAction.metadata?.expiryDate),
          batchNumber: createAction.metadata?.batchNumber || null,
        };
      } catch (err) {
        console.error('Label OCR capture failed:', err);
        return null;
      } finally {
        setStatus('idle');
      }
    },
    [getToken, membership?.organization.id],
  );

  return { processImage, status };
}
