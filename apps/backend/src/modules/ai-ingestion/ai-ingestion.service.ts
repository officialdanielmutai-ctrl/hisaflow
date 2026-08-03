import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma.service';
import OpenAI from 'openai';

export interface ParsedAction {
  // ── Transaction actions ──────────────────────────────────────────
  itemId: string | null;
  itemName: string;
  type: 'SALE' | 'PURCHASE' | 'WASTAGE' | 'CREATE' | 'UPDATE' | 'NOTE' | 'BOOKING' | 'GUEST' | 'ROOM';
  quantity: number;
  confidence: 'HIGH' | 'LOW';
  // ── Fields used only for WASTAGE ─────────────────────────────────
  wastageReason?: string;
  // ── Fields used only for BOOKING ─────────────────────────────────
  guestName?: string;
  roomName?: string;
  checkInDate?: string;
  checkOutDate?: string;
  // ── Fields used only for GUEST ───────────────────────────────────
  phone?: string;
  email?: string;
  idNumber?: string;
  // ── Fields used only for ROOM ────────────────────────────────────
  roomType?: string;
  baseRate?: number;
  // ── Business Specific Fields (Optional) ──────────────────────────
  clientName?: string;
  metadata?: any;
  // ── Credit Fields ────────────────────────────────────────────────
  isCredit?: boolean;
  dueDate?: string;
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
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // ── In-memory inventory cache (per org, 90-second TTL) ────────────
  private readonly inventoryCache = new Map<string, {
    items: Array<{ id: string; name: string; unit?: string; packaging?: Array<{ name: string; quantityPerUnit: number }> }>;
    businessType: string;
    expiresAt: number;
  }>();

  private async getInventoryContext(orgId: string) {
    const now = Date.now();
    const cached = this.inventoryCache.get(orgId);
    if (cached && cached.expiresAt > now) return cached;

    // Cache miss — fetch from DB
    const [items, org] = await Promise.all([
      this.prisma.db.inventoryItem.findMany({
        where: { organizationId: orgId, isActive: true },
        select: {
          id: true,
          name: true,
          unit: true,
          packaging: { select: { name: true, quantityPerUnit: true } },
        },
      }),
      this.prisma.db.organization.findUnique({
        where: { id: orgId },
        select: { businessType: true },
      }),
    ]);

    const entry = {
      items,
      businessType: org?.businessType ?? 'DUKA',
      expiresAt: now + 90_000, // 90 second TTL
    };
    this.inventoryCache.set(orgId, entry);
    return entry;
  }

  /** Invalidate cache for an org (call after inventory mutations) */
  invalidateCache(orgId: string) {
    this.inventoryCache.delete(orgId);
  }

  // ── RETRIEVAL LAYER ───────────────────────────────────────────────

  private readonly UNIT_STOP_WORDS = new Set([
    // Common containers / packaging
    'bottle', 'bottles', 'can', 'cans', 'tin', 'tins', 'crate', 'crates',
    'box', 'boxes', 'carton', 'cartons', 'packet', 'packets', 'pack', 'packs',
    'bag', 'bags', 'sack', 'sacks', 'bale', 'bales', 'bundle', 'bundles',
    'tray', 'trays', 'drum', 'drums', 'jerry', 'jerrycan', 'jerrycans',
    'tube', 'tubes', 'sachet', 'sachets', 'pouch', 'pouches', 'roll', 'rolls',
    'reel', 'reels', 'pair', 'pairs', 'set', 'sets',
    // Measurement units
    'kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms',
    'gram', 'grams', 'gm', 'mg', 'milligram', 'milligrams',
    'litre', 'litres', 'liter', 'liters', 'ltr', 'ltrs', 'ml', 'millilitre', 'millilitres',
    'piece', 'pieces', 'pcs', 'unit', 'units',
    'metre', 'metres', 'meter', 'meters', 'cm', 'mm',
    // Pharma-specific
    'tablet', 'tablets', 'tab', 'tabs', 'capsule', 'capsules', 'cap', 'caps',
    'strip', 'strips', 'vial', 'vials', 'ampoule', 'ampoules', 'injection', 'injections',
    'syrup', 'cream', 'ointment', 'inhaler', 'inhalers', 'drop', 'drops',
    // Filler verbs/adjectives that slip through
    'new', 'old', 'big', 'small', 'large', 'many', 'few', 'each',
    'today', 'yesterday', 'total', 'worth',
  ]);

  private readonly ACTION_STOP_WORDS = new Set([
    'i', 'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for',
    'with', 'have', 'has', 'had', 'is', 'are', 'was', 'were', 'be', 'been',
    'sold', 'sell', 'buy', 'bought', 'received', 'receive', 'got', 'get',
    'give', 'gave', 'used', 'use', 'took', 'take', 'put', 'added', 'add',
    'some', 'out', 'from', 'by', 'this', 'that', 'it', 'me', 'my', 'we',
    'damaged', 'expired', 'broken', 'stolen', 'lost', 'spoiled', 'created',
    'just', 'only', 'also', 'its', 'our', 'not', 'all', 'one', 'two', 'three',
  ]);

  private extractNouns(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => {
        if (w.length < 3) return false;
        if (this.ACTION_STOP_WORDS.has(w)) return false;
        if (this.UNIT_STOP_WORDS.has(w)) return false;
        // Skip pure numbers
        if (/^\d+$/.test(w)) return false;
        return true;
      });
  }

  private trigramScore(noun: string, itemName: string): number {
    const ngrams = (s: string) => {
      const padded = '  ' + s.toLowerCase() + '  ';
      const result = new Set<string>();
      for (let i = 0; i <= padded.length - 3; i++) result.add(padded.slice(i, i + 3));
      return result;
    };
    const aG = ngrams(noun);
    const bG = ngrams(itemName);
    const intersection = [...aG].filter(g => bG.has(g)).length;
    const union = new Set([...aG, ...bG]).size;
    return union === 0 ? 0 : intersection / union;
  }

  private retrieveRelevantItems(
    text: string,
    allItems: Array<{ id: string; name: string; unit?: string; packaging?: Array<{ name: string; quantityPerUnit: number }> }>,
    topN = 20,
  ) {
    const nouns = this.extractNouns(text);
    // If no meaningful product nouns found, return top items as fallback
    if (nouns.length === 0) return allItems.slice(0, topN);

    const scored = allItems.map(item => {
      const nameLower = item.name.toLowerCase();
      // Exact substring match (e.g. "alvaro" inside "alvaro malt") = very high score
      const exactMatch = nouns.some(n => nameLower.includes(n) || n.includes(nameLower));
      const substringBoost = exactMatch ? 0.7 : 0;
      // Best trigram score across all extracted nouns
      const trigramBest = Math.max(...nouns.map(n => this.trigramScore(n, item.name)));
      return { item, score: substringBoost + trigramBest };
    });

    return scored
      .filter(s => s.score > 0.15)
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
      .map(s => s.item);
  }

  async parseInventoryText(
    text: string,
    orgId: string,
  ): Promise<ParsedAction[]> {
    const { items: availableItems, businessType } = await this.getInventoryContext(orgId);

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

    // ── RETRIEVAL LAYER ────────────────────────────────────────────
    // Filter inventory down to the top ~20 most relevant items in-memory.
    // Lightning fast — no extra DB call, uses the 90s cache.
    const relevantItems = this.retrieveRelevantItems(text, availableItems);
    const itemsJson = JSON.stringify(relevantItems);

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

${businessType === 'GUEST_HOUSE' || businessType === 'LODGE' || businessType === 'HOTEL' ? `
GUEST_HOUSE/LODGE context:
- You manage rooms, guests, and consumption items (drinks, food, toiletries).
- "Check in", "booked", "room X" = BOOKING action. Always extract guest name, room name, and dates if mentioned.
- If dates are not mentioned, default to checkInDate: today, checkOutDate: tomorrow.
- "Consumed", "drank", "used by guest" = SALE (deduct from stock).
- "Received", "purchased" = PURCHASE.
- If a user says "John checked into Room 3 for 2 nights", return a BOOKING action with guestName="John", roomName="Room 3".
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
Each element is ONE action matching one of these 7 shapes:

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

7. BOOKING — Guest checked into a room:
{ "itemId": null, "itemName": "Booking", "type": "BOOKING", "quantity": 1, "confidence": "HIGH", "guestName": "<extracted name>", "roomName": "<extracted room>", "checkInDate": "<ISO date or null>", "checkOutDate": "<ISO date or null>" }

8. GUEST — Add a new guest to the directory (when user says "add guest", "register guest", "new guest"):
{ "itemId": null, "itemName": "<guest full name>", "type": "GUEST", "quantity": 1, "confidence": "HIGH", "guestName": "<full name>", "phone": "<phone or null>", "email": "<email or null>", "idNumber": "<id or null>" }

9. ROOM — Add a new room to the property (when user says "add room", "new room", "create room"):
{ "itemId": null, "itemName": "<room name>", "type": "ROOM", "quantity": 1, "confidence": "HIGH", "roomName": "<room name or number>", "roomType": "Single|Double|Standard|Suite|Deluxe", "baseRate": <number per night> }

RULES:
- The items listed above ARE CONFIRMED TO EXIST in this business's inventory. Treat them as ground truth.
- Match item names case-insensitively with STRONG spelling tolerance (e.g., "cipladon" ≈ "Cipladon", "panadole" ≈ "Panadol", "alvaroe" ≈ "Alvaro").
- ALWAYS prefer matching an existing item over creating a new one. Only use CREATE if you are certain the item is genuinely new and has no match in the list.
- If an item clearly exists in the list (fuzzy match), set confidence HIGH and use its itemId. NEVER output CREATE for an item that appears in the list.
- If an item does NOT exist in the list, use CREATE (itemId: null).
- Expired/damaged/stolen items = always WASTAGE, never SALE.
- If user mixes multiple actions, return one object per action.
- For SALE/PURCHASE/WASTAGE: default quantity = 1 if not stated.
- For CHEMIST: infer appropriate pharmaceutical unit (strips, tablets, capsules, bottles, vials, sachets) from the drug type if not stated.
- CRITICAL PACKAGING MULTIPLICATION RULE: The \`itemsJson\` contains \`packaging\` arrays indicating bulk sizes (e.g. { name: "Crate", quantityPerUnit: 14 }). If the user specifies a quantity in a bulk/packaging unit (e.g., "sold 5 crates of soda"), you MUST multiply the user's quantity by the \`quantityPerUnit\` of that packaging unit and output ONLY the absolute base unit quantity. Example: 5 Crates * 14 = 70. You output \`quantity: 70\`. DO NOT output the packaging unit name.
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
      const actions = Array.isArray(parsed) ? parsed : [];

      // ── RECONCILIATION LAYER ──────────────────────────────────────
      // The AI sometimes returns CREATE even when the item exists.
      // We run our own matching pass to catch these mistakes:
      //  1. Inject missing itemIds into SALE/PURCHASE/WASTAGE/UPDATE actions.
      //  2. Drop CREATE actions where a near-identical item already exists.
      //  3. Convert orphaned CREATE→SALE if context clearly implies a transaction.
      const MATCH_THRESHOLD = 0.45;

      const reconciled = actions.reduce<ParsedAction[]>((acc, action) => {
        // Pass through non-inventory action types directly
        if (action.type === 'NOTE' || action.type === 'BOOKING' || action.type === 'GUEST' || action.type === 'ROOM') {
          acc.push(action);
          return acc;
        }

        const nameToMatch = (action.itemName || '').trim();
        if (!nameToMatch) { acc.push(action); return acc; }

        // Find the best matching item from the FULL inventory (not just retrieved)
        let bestMatch: typeof availableItems[0] | null = null;
        let bestScore = 0;
        for (const item of availableItems) {
          const exact = item.name.toLowerCase().includes(nameToMatch.toLowerCase())
            || nameToMatch.toLowerCase().includes(item.name.toLowerCase());
          const tScore = this.trigramScore(nameToMatch, item.name);
          const score = (exact ? 0.7 : 0) + tScore;
          if (score > bestScore) { bestScore = score; bestMatch = item; }
        }

        if (action.type === 'CREATE') {
          if (bestMatch && bestScore >= MATCH_THRESHOLD) {
            // AI wrongly created something that already exists — drop the CREATE
            // (the corresponding SALE/PURCHASE action should already be in the list,
            //  or we'd have no action, which is safer than a duplicate)
            console.log(`[Reconciler] Dropped CREATE for "${nameToMatch}" — matched "${bestMatch.name}" (score ${bestScore.toFixed(2)})`);
            return acc; // skip this CREATE
          }
          acc.push(action);
          return acc;
        }

        // For SALE / PURCHASE / WASTAGE / UPDATE: inject itemId if missing
        if (!action.itemId && bestMatch && bestScore >= MATCH_THRESHOLD) {
          console.log(`[Reconciler] Injected itemId for "${nameToMatch}" — matched "${bestMatch.name}" (score ${bestScore.toFixed(2)})`);
          acc.push({ ...action, itemId: bestMatch.id, itemName: bestMatch.name });
          return acc;
        }

        acc.push(action);
        return acc;
      }, []);

      return reconciled;
    } catch (error) {
      console.error('AI parsing failed', error);
      return [];
    }
  }
}
