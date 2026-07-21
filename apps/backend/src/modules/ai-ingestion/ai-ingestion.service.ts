import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface ParsedAction {
  // ── Transaction actions ──────────────────────────────────────────
  itemId: string | null;
  itemName: string;
  type: 'SALE' | 'PURCHASE' | 'WASTAGE' | 'CREATE' | 'UPDATE' | 'NOTE';
  quantity: number;
  confidence: 'HIGH' | 'LOW';
  // ── Fields used only for WASTAGE ─────────────────────────────────
  wastageReason?: string; // e.g. 'expired', 'damaged', 'stolen', 'spoiled', 'broken'
  // ── Business Specific Fields (Optional) ──────────────────────────
  clientName?: string; // For ISP installs, etc.
  metadata?: any;
  // ── Credit Fields ────────────────────────────────────────────────
  isCredit?: boolean;
  dueDate?: string; // ISO string
  creditNotes?: string;
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
  // ── Fields used only for NOTE ────────────────────────────────────
  title?: string;
  content?: string;
  importance?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  checklists?: { text: string }[];
}

@Injectable()
export class AiIngestionService {
  constructor(private readonly configService: ConfigService) {}

  async parseInventoryText(
    text: string,
    availableItems: Array<{ id: string; name: string }>,
    businessType: string = 'DUKA',
  ): Promise<ParsedAction[]> {
    const baseUrl = this.configService.get<string>('litellm.baseUrl');
    const apiKey = this.configService.get<string>('litellm.masterKey');

    if (!baseUrl || !apiKey) {
      console.error('Missing LiteLLM configuration');
      return [];
    }

    const openai = new OpenAI({
      baseURL: baseUrl,
      apiKey: apiKey,
    });

    const itemsJson = JSON.stringify(availableItems);

    const prompt = `
You are an inventory management assistant for a business of type: ${businessType}.
You receive a list of existing inventory items (with id and name) and a free-text instruction from the user. Your job is to extract ALL intended inventory actions.

Context for Business Type (${businessType}):
- If ISP (Internet Service Provider): "Installed", "setup", or "deployed" usually means taking hardware from stock (SALE/issue) and deploying it to a client. Extract the client's name into the "clientName" field. If they mention an installation fee or labor, you can include that in metadata as "serviceFee".
- If CHEMIST: Focus on expiry dates and batch numbers if mentioned, put them in "metadata".
- For others: Standard retail operations.

Available items (JSON):
${itemsJson}

User text:
"${text}"

Instructions:
- Return ONLY a valid JSON array (no markdown fences, no extra commentary).
- Each element must match ONE of the five shapes below depending on the action type:

1. SALE — user sold, gave out, issued, or installed an existing item to a customer:
{
  "itemId": "<matching item id>",
  "itemName": "<original name from user>",
  "type": "SALE",
  "quantity": <number>,
  "confidence": "HIGH" | "LOW",
  "clientName": "<name of client if mentioned, or null>",
  "metadata": { <any extra info like service fees or location> },
  "isCredit": <true if the user mentions the items were taken on credit, loaned, or they will pay later, false otherwise>,
  "dueDate": "<ISO 8601 date string if they mention a time/date they will pay, else null>",
  "creditNotes": "<any extra notes about the credit>"
}
*Note: If the sale is on credit (isCredit: true), you MUST ALSO emit a separate "NOTE" action explaining that the item was taken on credit, mentioning the client name and amount/quantity.*

2. PURCHASE — user restocked, received, bought, or added an existing item:
{
  "itemId": "<matching item id>",
  "itemName": "<original name from user>",
  "type": "PURCHASE",
  "quantity": <number>,
  "confidence": "HIGH" | "LOW",
  "metadata": { <e.g. batch number or supplier> }
}

3. WASTAGE — stock was lost, destroyed, or written off for any non-sale reason.
   Trigger words: expired, expiry, expire, went bad, rotten, spoiled, spoilt, damaged, broken,
   cracked, leaked, leaking, stolen, theft, lost, missing, contaminated, mouldy, mold, flooded,
   fire, burned, burnt, write-off, written off, disposed, discarded, wasted, wastage, perished.
   IMPORTANT: Do NOT use SALE for any of these — always use WASTAGE.
{
  "itemId": "<matching item id>",
  "itemName": "<original name from user>",
  "type": "WASTAGE",
  "quantity": <number>,
  "confidence": "HIGH" | "LOW",
  "wastageReason": "<one of: expired | damaged | stolen | spoiled | broken | contaminated | lost | other — pick best match>"
}

4. CREATE — user wants to add a brand-new item that does NOT exist in the available items list:
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
  "category": "<category string or null>",
  "metadata": { <expiryDate, serialNumber, or batchNumber if mentioned> }
}

5. UPDATE — user wants to change details (price, name, unit, threshold, quantity) of an existing item:
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
6. NOTE — user wants to leave a note, memo, or checklist for the team:
{
  "itemId": null,
  "itemName": "Note",
  "type": "NOTE",
  "quantity": 0,
  "confidence": "HIGH",
  "title": "<short descriptive title>",
  "content": "<full details of the note>",
  "importance": "<infer from context: LOW, MEDIUM, HIGH, CRITICAL. If they say important, use HIGH. If urgent, use CRITICAL. Otherwise MEDIUM.>",
  "dueDate": "<ISO 8601 date string if they mention a time/date like 'tomorrow 10am', else null>",
  "checklists": [ { "text": "<item 1>" }, { "text": "<item 2>" } ] <only if they list items, else omit or empty array>
}

Rules:
- CRITICAL: expired, damaged, stolen, spoiled, broken items are always WASTAGE — never SALE.
- For SALE/PURCHASE/WASTAGE: match item names case-insensitively with minor spelling tolerance. Set confidence HIGH if matched, LOW if not.
- For CREATE: only use this type when the item clearly does NOT exist in the available list.
- For UPDATE: only include fields the user explicitly mentioned changing inside the updates object.
- If the user mixes actions return one object per distinct action.
- quantity for UPDATE and CREATE should reflect what the user stated. If not mentioned for CREATE, use 0.
- Extract numerical quantities. If not stated, default to 1 for SALE/PURCHASE/WASTAGE.
- Return only the JSON array. No markdown. No extra text.
`;

    try {
      const response = await openai.chat.completions.create({
        model: 'hisaflow-standard',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      });

      const rawText = response.choices?.[0]?.message?.content;
      if (!rawText) {
        console.error('No content in AI gateway response');
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
