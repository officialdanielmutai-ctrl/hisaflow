'use client';

import { useCallback, useRef, useState, type ChangeEvent } from 'react';
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
  // Sanity bound: reject anything wildly outside a plausible product-expiry
  // window, in case the model hallucinates a nonsense year.
  const year = parsed.getFullYear();
  if (year < 2000 || year > 2100) return null;
  return parsed.toISOString().split('T')[0];
}

/**
 * Captures a single photo of a product's packaging/label via the device
 * camera, runs it through the existing receipt-OCR text extraction
 * endpoint, then through the AI ingestion parser (LABEL_OCR mode) to pull
 * out structured product details.
 *
 * Renders no UI itself - spread `inputProps` onto a hidden <input>, then
 * call `captureLabel()` (returns a Promise that resolves to a result or
 * null on any failure/cancel - never throws, so callers can treat this as
 * an optional prefill exactly like the barcode/Open Food Facts lookup).
 */
export function useLabelOcrCapture() {
  const inputRef = useRef<HTMLInputElement>(null);
  const resolverRef = useRef<((result: LabelOcrResult | null) => void) | null>(null);
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const [status, setStatus] = useState<'idle' | 'processing'>('idle');

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';

      const resolve = resolverRef.current;
      resolverRef.current = null;

      if (!file || !membership?.organization.id) {
        resolve?.(null);
        return;
      }

      setStatus('processing');
      try {
        const token = await getToken();
        if (!token) {
          resolve?.(null);
          return;
        }

        const compressed = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        });

        const formData = new FormData();
        formData.append('image', compressed);

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

        if (!ocrRes.ok) {
          resolve?.(null);
          return;
        }

        const { text } = await ocrRes.json();
        if (!text?.trim()) {
          resolve?.(null);
          return;
        }

        const actions = await parseInventoryText(
          text,
          token,
          membership.organization.id,
          'LABEL_OCR',
        );
        const createAction = actions.find((a) => a.type === 'CREATE');
        if (!createAction) {
          resolve?.(null);
          return;
        }

        resolve?.({
          name: createAction.itemName || null,
          category: createAction.category || null,
          unit: createAction.unit || null,
          expiryDate: normalizeDateForInput(createAction.metadata?.expiryDate),
          batchNumber: createAction.metadata?.batchNumber || null,
        });
      } catch (err) {
        console.error('Label OCR capture failed:', err);
        resolve?.(null);
      } finally {
        setStatus('idle');
      }
    },
    [getToken, membership?.organization.id],
  );

  const captureLabel = useCallback((): Promise<LabelOcrResult | null> => {
    return new Promise((resolve) => {
      if (!inputRef.current) {
        resolve(null);
        return;
      }
      resolverRef.current = resolve;
      inputRef.current.click();
    });
  }, []);

  const inputProps = {
    ref: inputRef,
    type: 'file' as const,
    accept: 'image/*',
    capture: 'environment' as const,
    onChange: handleFileChange,
    style: { display: 'none' },
  };

  return { captureLabel, status, inputProps };
}
