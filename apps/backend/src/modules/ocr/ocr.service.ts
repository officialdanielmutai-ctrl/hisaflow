import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { hashImage, TtlCache } from './lib/ocr-cache';

const OCR_PROMPT = `You are an OCR assistant. Extract all text from this receipt or invoice image exactly as printed.

Instructions:
- Preserve line breaks and the original layout as closely as possible.
- For each line or block of text you extract:
    - If you are confident in the reading, prefix it with [CONFIDENCE: HIGH]
    - If the text is blurry, partially obscured, or you are uncertain about any characters, prefix it with [CONFIDENCE: LOW]
- Do NOT summarise, interpret, or add any commentary — only the raw extracted text with confidence labels.
- If the image contains no readable text at all, respond with exactly the single word: NO_TEXT_FOUND`;

/** How long an identical image's OCR text is reused before re-scanning. */
export const OCR_CACHE_TTL_MS = 10 * 60 * 1000;
/** Upper bound on cached images, so a busy instance cannot grow unbounded. */
export const OCR_CACHE_MAX_ENTRIES = 200;
/** Bound the vision model's output — OCR text, not an essay. */
const OCR_MAX_TOKENS = 2048;

/**
 * OCR via the shared LiteLLM gateway (`hisaflow-vision` model group).
 *
 * Deliberately does **not** call a provider directly any more: routing through
 * the gateway means the admin provider switch, gateway request/cost logging and
 * (future) LiteLLM budgets cover OCR the same way they cover every other AI
 * call. The vision group is a dedicated, ordered (non-shuffled) model chain in
 * `apps/gateway/config.yaml`.
 *
 * Speed strategy: OCR is the slow, metered step, so a repeated image (retry,
 * double-tap, re-scan) is served from a short-lived in-process cache, and
 * concurrent identical uploads share a single in-flight gateway call rather
 * than each paying for their own.
 */
@Injectable()
export class OcrService {
  private readonly cache = new TtlCache<string>(OCR_CACHE_TTL_MS, OCR_CACHE_MAX_ENTRIES);
  private readonly inFlight = new Map<string, Promise<string>>();

  constructor(private readonly config: ConfigService) {}

  async extractTextFromImage(
    imageBuffer: Buffer,
    mimeType: string = 'image/jpeg',
  ): Promise<{ text: string }> {
    const baseUrl = this.config.get<string>('litellm.baseUrl');
    const apiKey = this.config.get<string>('litellm.masterKey');
    if (!baseUrl || !apiKey) {
      throw new InternalServerErrorException('AI gateway is not configured.');
    }

    const key = hashImage(imageBuffer);

    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return { text: cached };
    }

    const pending = this.inFlight.get(key);
    if (pending) {
      return { text: await pending };
    }

    const request = this.runVisionExtraction(imageBuffer, mimeType, baseUrl, apiKey);
    this.inFlight.set(key, request);
    try {
      const text = await request;
      this.cache.set(key, text);
      return { text };
    } finally {
      this.inFlight.delete(key);
    }
  }

  /** Test/ops hook: drop every cached OCR result. */
  clearCache(): void {
    this.cache.clear();
  }

  private async runVisionExtraction(
    imageBuffer: Buffer,
    mimeType: string,
    baseUrl: string,
    apiKey: string,
  ): Promise<string> {
    const openai = new OpenAI({ baseURL: baseUrl, apiKey });
    const dataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

    try {
      const response = await openai.chat.completions.create({
        model: 'hisaflow-vision',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: OCR_PROMPT },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: OCR_MAX_TOKENS,
      });

      const extractedText = response.choices?.[0]?.message?.content ?? '';

      if (!extractedText || extractedText.trim() === 'NO_TEXT_FOUND') {
        return '';
      }

      return extractedText.trim();
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      const message = error instanceof Error ? error.message : 'OCR request failed';
      console.error('OCR Service Error:', message);
      throw new InternalServerErrorException(message);
    }
  }
}
