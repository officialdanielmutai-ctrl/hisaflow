import { Injectable, InternalServerErrorException } from '@nestjs/common';

@Injectable()
export class OcrService {
  private readonly VISION_API_KEY = process.env.CLOUD_VISION_API_KEY;

  async extractTextFromImage(imageBuffer: Buffer): Promise<{ text: string }> {
    if (!this.VISION_API_KEY || this.VISION_API_KEY === 'your_vision_key_here') {
      throw new InternalServerErrorException('Google Cloud Vision API key is not configured.');
    }

    const base64Image = imageBuffer.toString('base64');
    
    try {
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${this.VISION_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                image: {
                  content: base64Image,
                },
                features: [
                  {
                    type: 'TEXT_DETECTION',
                  },
                ],
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Vision API Error:', errorData);
        throw new InternalServerErrorException('Failed to process image with Vision API.');
      }

      const data = await response.json();
      const annotation = data.responses?.[0]?.fullTextAnnotation;

      if (!annotation || !annotation.pages || annotation.pages.length === 0) {
        return { text: '' };
      }

      const CONFIDENCE_THRESHOLD = 0.75;
      let combinedText = '';

      // Parse blocks to extract text and attach deterministic confidence labels
      for (const page of annotation.pages) {
        if (!page.blocks) continue;
        
        for (const block of page.blocks) {
          let blockText = '';
          const blockConfidence = block.confidence || 0;
          const confidenceLabel = blockConfidence < CONFIDENCE_THRESHOLD ? '[CONFIDENCE: LOW]' : '[CONFIDENCE: HIGH]';

          if (block.paragraphs) {
            for (const paragraph of block.paragraphs) {
              if (paragraph.words) {
                for (const word of paragraph.words) {
                  const wordText = word.symbols ? word.symbols.map((s: any) => s.text).join('') : '';
                  blockText += wordText + ' ';
                }
              }
              blockText += '\n';
            }
          }
          
          if (blockText.trim()) {
            combinedText += `${confidenceLabel} ${blockText.trim()}\n\n`;
          }
        }
      }

      return { text: combinedText.trim() };
    } catch (error: any) {
      console.error('OCR Service Error:', error);
      throw new InternalServerErrorException(error.message || 'Error processing OCR request.');
    }
  }
}
