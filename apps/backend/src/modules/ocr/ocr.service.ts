import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

const OCR_PROMPT = `You are an OCR assistant. Extract all text from this receipt or invoice image exactly as printed.

Instructions:
- Preserve line breaks and the original layout as closely as possible.
- For each line or block of text you extract:
    - If you are confident in the reading, prefix it with [CONFIDENCE: HIGH]
    - If the text is blurry, partially obscured, or you are uncertain about any characters, prefix it with [CONFIDENCE: LOW]
- Do NOT summarise, interpret, or add any commentary — only the raw extracted text with confidence labels.
- If the image contains no readable text at all, respond with exactly the single word: NO_TEXT_FOUND`;

/**
 * OCR via the shared LiteLLM gateway (`hisaflow-vision` model group).
 *
 * Deliberately does **not** call a provider directly any more: routing through
 * the gateway means the admin provider switch, gateway request/cost logging and
 * (future) LiteLLM budgets cover OCR the same way they cover every other AI
 * call. The vision group is a dedicated, ordered (non-shuffled) model chain in
 * `apps/gateway/config.yaml`.
 */
@Injectable()
export class OcrService {
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
      });

      const extractedText = response.choices?.[0]?.message?.content ?? '';

      if (!extractedText || extractedText.trim() === 'NO_TEXT_FOUND') {
        return { text: '' };
      }

      return { text: extractedText.trim() };
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      const message = error instanceof Error ? error.message : 'OCR request failed';
      console.error('OCR Service Error:', message);
      throw new InternalServerErrorException(message);
    }
  }
}
