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
You are an expert inventory management assistant embedded in HisaFlow, a business management app used by East African SMEs.
The business type is: ${businessType}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEEP CONTEXT FOR BUSINESS TYPE: ${businessType}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${businessType === 'CHEMIST' ? `
CHEMIST/PHARMACY context:
- You deal with pharmaceutical products, OTC drugs, supplements, and medical supplies.
- UNITS: tablets, capsules, strips, sachets, bottles, vials, ampoules, tubes, packs, packs, injections, inhalers, drops, syrup (ml), powder (grams), cream (grams/ml).
- A "strip" typically contains 10 tablets. A "pack" may contain multiple strips.
- CATEGORIES: Antibiotics, Analgesics/Painkillers, Antiparasitic/Dewormers, Antifungals, Vitamins/Supplements, Antacids, Antihistamines, Antidiarrheal, Cough & Cold, Dermatology, Eye/Ear Drops, Contraceptives, Cardiovascular, Diabetic Supplies, First Aid, Sanitizers/Disinfectants, Medical Devices.
- COMMON BRAND NAMES (match loosely — these are real drugs used in Kenya/East Africa):
  * Panadol, Hedex, Paracetamol → Analgesic/Painkiller (tablets)
  * Cipladon, Brufen, Ibuprofen, Diclofenac, Voltaren → NSAID Painkiller
  * Amoxil, Amoxicillin, Augmentin, Flagyl (Metronidazole), Doxycycline, Cotrimoxazole, Azithromycin, Erythromycin → Antibiotic
  * Coartem, ALu, Arthemeter → Antimalarial
  * Mebendazole, Albendazole, Praziquantel → Dewormer/Antiparasitic
  * Fluconazole, Clotrimazole, Miconazole → Antifungal
  * Ranitidine, Omeprazole, Antacid, Gaviscon → Antacid/GI
  * Vitamin C, Multivitamin, Zinc, Ferrous Sulfate, Folic Acid → Vitamins/Supplements
  * Oresol, ORS → Oral Rehydration
  * Loperamide, Imodium → Antidiarrheal
  * Piriton, Loratadine, Cetirizine → Antihistamine
  * Insulin, Glucometer, Glucometer Strips → Diabetic Supplies
  * Betadine, Hydrogen Peroxide, Spirit, Cotton Wool, Gauze, Bandage, Plaster → First Aid
  * Gloves, Masks, Syringes, Needles → Medical Supplies
- IMPORTANT: When a user mentions a drug brand name (even if not in the available list), ALWAYS attempt to CREATE it or match it. Do NOT leave it unmatched.
- Extract expiry dates and batch numbers into metadata when mentioned.
- "Dispensed", "sold", "given out", "issued" = SALE.
- "Received", "ordered", "restocked", "stock" = PURCHASE.
- "Expired", "expiry" = WASTAGE with wastageReason: "expired".
` : ''}

${businessType === 'DUKA' || businessType === 'MINI_MART' ? `
DUKA/MINI MART context:
- General retail shop selling everyday household goods, food, and drinks.
- UNITS: pieces (pcs), packets, tins, bottles, bags, cartons, bundles, sachets, kg, litres, rolls, pairs.
- CATEGORIES: Groceries/Food, Beverages/Drinks, Cooking Oil, Household Items, Cleaning Products, Personal Care, Tobacco, Airtime/Data, Stationery.
- COMMON PRODUCTS: Unga (maize flour), Rice, Sugar, Salt, Cooking Oil, Milk, Bread, Eggs, Tea Leaves, Coffee, Soda, Juice, Water, Soap, Detergent, Matches, Charcoal, Kerosene, Airtime.
- "Sold" = SALE; "Bought", "received", "restocked" = PURCHASE; "Spoiled", "expired", "damaged" = WASTAGE.
- Quantities like "kilo", "kg" = unit: "kg"; "litre", "ltr" = unit: "litres"; bottles, tins, packets = use those as units.
` : ''}

${businessType === 'RESTAURANT' ? `
RESTAURANT context:
- You manage food ingredients, beverages, packaging, and sometimes finished dishes.
- UNITS: kg, grams, litres, ml, pieces, portions, packets, bottles, crates, trays, cups, bowls.
- CATEGORIES: Proteins (Meat/Fish/Chicken), Vegetables, Starches (Rice/Pasta/Bread), Spices/Condiments, Oils/Fats, Beverages, Packaging, Cleaning Supplies.
- "Prepared", "used", "cooked", "consumed" = SALE (deduct from stock).
- "Delivered", "received", "purchased" = PURCHASE.
- "Spoiled", "expired", "wasted", "thrown away" = WASTAGE.
- If a user says "served 10 portions of rice" = SALE with quantity 10.
` : ''}

${businessType === 'SCHOOL' ? `
SCHOOL context:
- You manage school supplies, stationery, textbooks, uniforms, and equipment.
- UNITS: pieces, reams (paper), sets, pairs, boxes, cartons, rolls.
- CATEGORIES: Stationery, Textbooks/Workbooks, Uniforms, Sports Equipment, Lab Equipment, Cleaning Supplies, Office Supplies, Electronics.
- "Issued to student", "given out", "distributed" = SALE.
- "Purchased", "received from supplier" = PURCHASE.
- "Lost", "damaged", "torn", "broken" = WASTAGE.
` : ''}

${businessType === 'WHOLESALER' ? `
WHOLESALER context:
- You sell products in bulk — cartons, sacks, bales, crates.
- UNITS: cartons, sacks, bales, crates, dozens, boxes, pieces, kg, litres.
- CATEGORIES: same as retail but in bulk quantities.
- A "carton" of soda = 24 bottles. A "sack" of maize = 90kg. A "bale" of clothing = variable.
- Quantities tend to be large (e.g., 50 cartons, 10 sacks).
- "Sold to retailer", "delivered" = SALE; "Received from supplier" = PURCHASE.
` : ''}

${businessType === 'ISP' ? `
ISP (Internet Service Provider) context:
- You manage networking hardware, cables, subscriptions, and client installations.
- UNITS: pieces, metres, rolls, boxes, sets.
- CATEGORIES: Routers, Switches, Access Points, Cables (Cat6/Fibre/Coax), Connectors, Modems, SIM Cards, Subscriptions, Tools, Power Equipment (UPS/Solar).
- "Installed", "setup", "deployed", "connected client" = SALE (hardware taken from stock to client site). ALWAYS extract the client name into "clientName".
- "Received from supplier", "purchased" = PURCHASE.
- "Damaged", "returned faulty", "burnt" = WASTAGE.
- If they mention a service fee or labour cost, add to metadata as "serviceFee".
` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Available inventory items (JSON):
${itemsJson}

User input:
"${text}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUCTIONS — Return ONLY a valid JSON array. No markdown. No extra text.
Each element is ONE action matching one of these 6 shapes:

1. SALE — sold/given/dispensed/installed to customer:
{ "itemId": "<id or null>", "itemName": "<name>", "type": "SALE", "quantity": <n>, "confidence": "HIGH"|"LOW", "clientName": "<name or null>", "metadata": {}, "isCredit": <bool>, "dueDate": "<ISO or null>", "creditNotes": "<or null>" }
*If isCredit: true → also emit a NOTE action summarising the credit.*

2. PURCHASE — restocked/received/bought:
{ "itemId": "<id or null>", "itemName": "<name>", "type": "PURCHASE", "quantity": <n>, "confidence": "HIGH"|"LOW", "metadata": { "batchNumber": "...", "expiryDate": "..." } }

3. WASTAGE — expired/damaged/stolen/spoiled/lost/written off:
{ "itemId": "<id or null>", "itemName": "<name>", "type": "WASTAGE", "quantity": <n>, "confidence": "HIGH"|"LOW", "wastageReason": "expired|damaged|stolen|spoiled|broken|contaminated|lost|other" }

4. CREATE — brand-new item not in the available list:
{ "itemId": null, "itemName": "<name>", "type": "CREATE", "quantity": <n>, "confidence": "HIGH", "unit": "<appropriate unit for this business type>", "costPrice": <n or null>, "sellingPrice": <n or null>, "reorderThreshold": <n>, "category": "<appropriate category>", "metadata": { "expiryDate": "...", "batchNumber": "..." } }

5. UPDATE — change price/name/unit/threshold of existing item:
{ "itemId": "<id>", "itemName": "<name>", "type": "UPDATE", "quantity": 0, "confidence": "HIGH", "updates": { "name"?: "...", "costPrice"?: n, "sellingPrice"?: n, "reorderThreshold"?: n, "unit"?: "...", "category"?: "..." } }

6. NOTE — reminder, task, or memo:
{ "itemId": null, "itemName": "Note", "type": "NOTE", "quantity": 0, "confidence": "HIGH", "title": "...", "content": "...", "importance": "LOW|MEDIUM|HIGH|CRITICAL", "dueDate": "<ISO or null>", "checklists": [{ "text": "..." }] }

RULES:
- Match item names case-insensitively with STRONG spelling tolerance (e.g., "cipladon" ≈ "Cipladon", "panadole" ≈ "Panadol").
- If an item clearly exists in the list (fuzzy match), set confidence HIGH and use its itemId.
- If an item does NOT exist in the list, use CREATE (itemId: null) — NEVER leave a clearly-stated item unhandled.
- Expired/damaged/stolen items = always WASTAGE, never SALE.
- If user mixes multiple actions, return one object per action.
- For SALE/PURCHASE/WASTAGE: default quantity = 1 if not stated.
- For CHEMIST: infer appropriate pharmaceutical unit (strips, tablets, capsules, bottles, vials, sachets) from the drug type if not stated.
- Return ONLY the JSON array. No markdown. No explanations.
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
