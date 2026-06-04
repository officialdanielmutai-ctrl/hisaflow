import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ParsedAction {
  itemId: string | null;
  itemName: string;
  type: 'SALE' | 'PURCHASE';
  quantity: number;
  confidence: 'HIGH' | 'LOW';
}

@Injectable()
export class AiIngestionService {
  constructor(private readonly configService: ConfigService) {}

  async parseInventoryText(
    text: string,
    availableItems: Array<{ id: string; name: string }>,
  ): Promise<ParsedAction[]> {
    const apiKey = this.configService.get<string>('gemini.apiKey');
    if (!apiKey) {
      console.error('Missing GEMINI_API_KEY');
      return [];
    }

    const model =
      this.configService.get<string>('gemini.model') ?? 'gemini-2.5-flash';

    const itemsJson = JSON.stringify(availableItems);

    const prompt = `
You are an inventory extraction assistant. You are given a list of available items in the system (with id and name). The user will describe inventory actions in free text.

Available items (JSON):
${itemsJson}

User text:
"${text}"

Instructions:
- Return ONLY a JSON array (no markdown code fences, no additional text) of objects with the following shape:
  {
    "itemId": string | null,  // if the item name in the text closely matches an available item, set this to the matching item's id; otherwise null
    "itemName": string,        // the item name mentioned by the user (original)
    "type": "SALE" | "PURCHASE",
    "quantity": number,
    "confidence": "HIGH" | "LOW"
  }
- If an item name in the text closely matches an available item (case-insensitive, minor spelling variations), set "itemId" to the matched item's id and "confidence" to "HIGH".
- If no match found, set "itemId" to null and "confidence" to "LOW".
- Infer the type from the text:
  - words like "sold", "sale", "sold out", "gave out" → "SALE"
  - words like "received", "bought", "stock in", "added", "delivery", "restock" → "PURCHASE"
  - If ambiguous, default to "SALE".
- Extract numerical quantity from the text. If not found, use 1.
- Return one object per action mentioned. Do not merge items of different names.
- The JSON array must be valid and contain only those objects. No commentary.
`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        console.error('Gemini API error', response.status, await response.text());
        return [];
      }

      const data = await response.json();
      const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        console.error('No content in Gemini response');
        return [];
      }

      // Strip possible markdown fences
      let cleaned = rawText.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7);
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
      }

      const parsed = JSON.parse(cleaned) as ParsedAction[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('AI parsing failed', error);
      return [];
    }
  }
}
