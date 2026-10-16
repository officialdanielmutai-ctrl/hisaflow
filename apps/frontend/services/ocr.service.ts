import { API_BASE_URL } from '@/lib/api-client';
import type { ParsedAction } from './ai-ingestion.service';

export type OcrSource = 'RECEIPT_OCR' | 'LABEL_OCR';

export interface OcrParseResult {
  text: string;
  actions: ParsedAction[];
}

/**
 * One round trip for a captured image: the backend OCRs it and feeds the text
 * straight into AI ingestion (see `POST /ocr/receipt/parse`). Keeping both
 * steps server-side halves the number of client→server hops on a slow mobile
 * connection and lets the backend overlap its inventory-context fetch with the
 * vision model. The raw `text` is still returned so callers can show what was
 * read.
 */
export async function ocrAndParseImage(
  image: Blob,
  token: string,
  organizationId: string,
  source: OcrSource,
  signal?: AbortSignal,
): Promise<OcrParseResult> {
  const formData = new FormData();
  formData.append('image', image, source === 'LABEL_OCR' ? 'label.jpg' : 'receipt.jpg');
  formData.append('source', source);

  const response = await fetch(`${API_BASE_URL}/ocr/receipt/parse`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-organization-id': organizationId,
    },
    body: formData,
    signal,
  });

  if (!response.ok) {
    let message = 'Failed to process image';
    try {
      const body = await response.json();
      message = body?.message || message;
    } catch {
      // Keep the default message when the body is not JSON.
    }
    throw new Error(message);
  }

  const data = (await response.json()) as Partial<OcrParseResult>;
  return { text: data.text ?? '', actions: data.actions ?? [] };
}
