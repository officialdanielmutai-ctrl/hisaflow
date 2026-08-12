import { Injectable, InternalServerErrorException } from '@nestjs/common';

@Injectable()
export class OcrService {
  private readonly GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  private readonly GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  async extractTextFromImage(
    imageBuffer: Buffer,
    mimeType: string = 'image/jpeg',
  ): Promise<{ text: string }> {
    if (!this.GEMINI_API_KEY) {
      throw new InternalServerErrorException('Gemini API key is not configured.');
    }

    const base64Image = imageBuffer.toString('base64');

    const prompt = `You are an OCR assistant. Extract all text from this receipt or invoice image exactly as printed.

Instructions:
- Preserve line breaks and the original layout as closely as possible.
- For each line or block of text you extract:
    - If you are confident in the reading, prefix it with [CONFIDENCE: HIGH]
    - If the text is blurry, partially obscured, or you are uncertain about any characters, prefix it with [CONFIDENCE: LOW]
- Do NOT summarise, interpret, or add any commentary — only the raw extracted text with confidence labels.
- If the image contains no readable text at all, respond with exactly the single word: NO_TEXT_FOUND`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.GEMINI_MODEL}:generateContent?key=${this.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType,
                      data: base64Image,
                    },
                  },
                  { text: prompt },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 4096,
            },
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Gemini Vision API Error:', errorData);
        throw new InternalServerErrorException(
          `Gemini Vision API returned ${response.status}: ${JSON.stringify(errorData)}`,
        );
      }

      const data = await response.json();
      const extractedText: string =
        data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      if (!extractedText || extractedText.trim() === 'NO_TEXT_FOUND') {
        return { text: '' };
      }

      return { text: extractedText.trim() };
    } catch (error: any) {
      if (error instanceof InternalServerErrorException) throw error;
      console.error('OCR Service Error:', error);
      throw new InternalServerErrorException(
        error.message || 'Error processing OCR request.',
      );
    }
  }
}

