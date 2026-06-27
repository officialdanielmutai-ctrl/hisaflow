import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ParsedAction {
  // ── Transaction actions ──────────────────────────────────────────
  itemId: string | null;
  itemName: string;
  type: 'SALE' | 'PURCHASE' | 'CREATE' | 'UPDATE';
  quantity: number;
  confidence: 'HIGH' | 'LOW';
  // ── Fields used only for CREATE ──────────────────────────────────
  unit?: string;
  costPrice?: number;
  sellingPrice?: number;
  reorderThreshold?: number;
  category?: string;
  // ── Fields used only for UPDATE ──────────────────────────────────
  updates?: {
    name?: string;
    unit?: string;
    costPrice?: number;
    sellingPrice?: number;
    reorderThreshold?: number;
    category?: string;
    quantity?: number;
  };
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
You are an inventory management assistant. You receive a list of existing inventory items (with id and name) and a free-text instruction from the user. Your job is to extract ALL intended inventory actions.

Available items (JSON):
${itemsJson}

User text:
"${text}"

Instructions:
- Return ONLY a valid JSON array (no markdown fences, no extra commentary).
- Each element must match ONE of the four shapes below depending on the action type:

1. SALE — user sold or gave out an existing item:
{
  "itemId": "<matching item id>",
  "itemName": "<original name from user>",
  "type": "SALE",
  "quantity": <number>,
  "confidence": "HIGH" | "LOW"
}

2. PURCHASE — user restocked or received an existing item:
{
  "itemId": "<matching item id>",
  "itemName": "<original name from user>",
  "type": "PURCHASE",
  "quantity": <number>,
  "confidence": "HIGH" | "LOW"
}

3. CREATE — user wants to add a brand-new item that does NOT exist in the available items list:
{
  "itemId": null,
  "itemName": "<name of the new item>",
  "type": "CREATE",
  "quantity": <initial stock quantity, default 0>,
  "confidence": "HIGH",
  "unit": "<unit e.g. pcs, kg, litres — infer from context, default pcs>",
  "costPrice": <number or null>,
  "sellingPrice": <number or null>,
  "reorderThreshold": <number, default 5>,
  "category": "<category string or null>"
}

4. UPDATE — user wants to change details (price, name, unit, threshold, quantity) of an existing item:
{
  "itemId": "<matching item id>",
  "itemName": "<original item name>",
  "type": "UPDATE",
  "quantity": 0,
  "confidence": "HIGH",
  "updates": {
    "name": "<new name or omit>",
    "costPrice": <number or omit>,
    "sellingPrice": <number or omit>,
    "reorderThreshold": <number or omit>,
    "unit": "<string or omit>",
    "category": "<string or omit>",
    "quantity": <number or omit — only if user explicitly sets stock to a specific number>
  }
}

Rules:
- For SALE/PURCHASE: match item names case-insensitively with minor spelling tolerance. Set confidence HIGH if matched, LOW if not.
- For CREATE: only use this type when the item clearly does NOT exist in the available list.
- For UPDATE: only include fields the user explicitly mentioned changing inside the updates object.
- If the user mixes actions return one object per distinct action.
- quantity for UPDATE and CREATE should reflect what the user stated. If not mentioned for CREATE, use 0.
- Extract numerical quantities. If not stated, default to 1 for SALE/PURCHASE.
- Return only the JSON array. No markdown. No extra text.
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
