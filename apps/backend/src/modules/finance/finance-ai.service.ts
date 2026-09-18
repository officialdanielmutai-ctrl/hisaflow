import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface PriceSuggestion {
  itemId: string;
  name: string;
  unit: string;
  currentCostPrice: number | null;
  currentSellingPrice: number | null;
  suggestedCostPrice: number | null;
  suggestedSellingPrice: number | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  note: string;
}

@Injectable()
export class FinanceAiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getForecast(
    organizationId: string,
    overview: any,
  ): Promise<{ insights: Array<{ title: string; body: string; sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' }> }> {
    const org = await this.prisma.db.organization.findUnique({
      where: { id: organizationId },
      select: { businessType: true },
    });
    const businessType = org?.businessType ?? 'Retail';

    const prompt = `You are a Chief Financial Officer (CFO) advising a small business owner in Kenya.
The business type is: ${businessType}. Adapt your vocabulary (e.g. for an ISP use terms like truck rolls, installations, service contracts; for a Chemist use terms like regulatory waste, expiry risk).
Here is their current financial data for the last 30 days:

Gross Revenue (from sales): KES ${overview.grossRevenue.toFixed(2)}
Gross Profit (sales minus cost of goods): KES ${overview.grossProfit.toFixed(2)}
Gross Margin: ${overview.grossMarginPct != null ? overview.grossMarginPct.toFixed(1) + '%' : 'N/A'}
Total Operating Expenses (rent, salaries, bills, etc.): KES ${overview.totalOperatingExpenses.toFixed(2)}
Net Profit (after all expenses): KES ${overview.netProfit.toFixed(2)}
Net Margin: ${overview.netMarginPct != null ? overview.netMarginPct.toFixed(1) + '%' : 'N/A'}
Inventory Value (at cost): KES ${overview.totalInventoryValue.toFixed(2)}
Items Without Prices: ${overview.unpricedCount}
Expense Breakdown: ${overview.expensesByCategory.map((e: any) => `${e.category}: KES ${e.total.toFixed(0)}`).join(', ') || 'No expenses logged yet'}

Provide 4 short, honest, actionable financial insights this owner should know right now.
Format your response as a JSON array of objects:
{ "title": "<short title>", "body": "<2-3 plain sentences>", "sentiment": "POSITIVE" | "NEGATIVE" | "NEUTRAL" }

Rules:
- Use plain language a non-accountant can understand. No jargon.
- Be honest about net losses if the data shows them.
- If operating expenses are high relative to profit, address this directly.
- Include at least one tip on cost control or pricing if net margin is below 15%.
- Return ONLY the JSON array, no markdown fences.`;

    const baseUrl = this.config.get<string>('litellm.baseUrl');
    const apiKey = this.config.get<string>('litellm.masterKey');
    if (!baseUrl || !apiKey) return this.fallbackForecast();

    const openai = new OpenAI({
      baseURL: baseUrl,
      apiKey: apiKey,
    });

    try {
      const response = await openai.chat.completions.create({
        model: 'hisaflow-standard',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
      });

      const raw = response.choices?.[0]?.message?.content;
      if (!raw) throw new Error('No content from gateway');
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return { insights: parsed };
      throw new Error('Invalid structure');
    } catch {
      return this.fallbackForecast();
    }
  }

  async getPriceSuggestions(organizationId: string): Promise<PriceSuggestion[]> {
    const items = await this.prisma.db.inventoryItem.findMany({
      where: { organizationId, isActive: true, OR: [{ costPrice: null }, { sellingPrice: null }] },
    });
    if (items.length === 0) return [];

    const itemList = items
      .map((i) => `- "${i.name}" (unit: ${i.unit}, category: ${i.category ?? 'general'}, costPrice: ${i.costPrice ?? 'unknown'}, sellingPrice: ${i.sellingPrice ?? 'unknown'})`)
      .join('\n');

    const prompt = `You are a pricing expert familiar with Kenyan retail market prices (in KES).
For each item below, suggest a realistic costPrice and sellingPrice in KES.
Items that already have a price set should still be returned but only suggest the missing field.

Items:
${itemList}

Return a JSON array with one object per item:
{
  "name": "<exact item name as given>",
  "suggestedCostPrice": <number in KES>,
  "suggestedSellingPrice": <number in KES>,
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "note": "<one sentence explaining the basis for the price>"
}

Rules:
- Suggested selling price must always be higher than cost price.
- Use realistic Kenyan market prices.
- Return ONLY the JSON array, no markdown.`;

    const baseUrl = this.config.get<string>('litellm.baseUrl');
    const apiKey = this.config.get<string>('litellm.masterKey');
    if (!baseUrl || !apiKey) return this.fallbackSuggestions(items);

    const openai = new OpenAI({
      baseURL: baseUrl,
      apiKey: apiKey,
    });

    try {
      const response = await openai.chat.completions.create({
        model: 'hisaflow-standard',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });

      const raw = response.choices?.[0]?.message?.content;
      if (!raw) throw new Error('No content from gateway');
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (Array.isArray(parsed)) {
        return items.map((item) => {
          const suggestion = parsed.find(
            (p: any) => p.name?.toLowerCase() === item.name.toLowerCase(),
          );
          return {
            itemId: item.id,
            name: item.name,
            unit: item.unit,
            currentCostPrice: item.costPrice != null ? Number(item.costPrice) : null,
            currentSellingPrice: item.sellingPrice != null ? Number(item.sellingPrice) : null,
            suggestedCostPrice: suggestion?.suggestedCostPrice != null ? Number(suggestion.suggestedCostPrice) : null,
            suggestedSellingPrice: suggestion?.suggestedSellingPrice != null ? Number(suggestion.suggestedSellingPrice) : null,
            confidence: (suggestion?.confidence ?? 'LOW') as 'HIGH' | 'MEDIUM' | 'LOW',
            note: suggestion?.note ?? 'Market estimate based on item category',
          };
        });
      }
      throw new Error('Invalid structure');
    } catch {
      return this.fallbackSuggestions(items);
    }
  }

  private fallbackForecast() {
    return {
      insights: [
        { title: 'Track All Costs', body: 'Log your rent, salaries, and utility bills so your Net Profit figure is accurate. Right now only inventory costs are tracked.', sentiment: 'NEUTRAL' as const },
        { title: 'Watch Your Margins', body: 'Your gross margin shows what you keep after buying stock. Aim for at least 15–30% to cover operating expenses.', sentiment: 'NEUTRAL' as const },
        { title: 'Control Operating Costs', body: 'Rent, staff, and utilities are fixed costs that eat into profit every month. Track them consistently to spot savings opportunities.', sentiment: 'NEUTRAL' as const },
        { title: 'Keep Records Updated', body: 'Log every sale, expense, and restock consistently so your financial picture stays accurate.', sentiment: 'NEUTRAL' as const },
      ],
    };
  }

  private fallbackSuggestions(items: any[]): PriceSuggestion[] {
    return items.map((item) => ({
      itemId: item.id, name: item.name, unit: item.unit,
      currentCostPrice: item.costPrice != null ? Number(item.costPrice) : null,
      currentSellingPrice: item.sellingPrice != null ? Number(item.sellingPrice) : null,
      suggestedCostPrice: null, suggestedSellingPrice: null,
      confidence: 'LOW' as const,
      note: 'Automatic suggestion unavailable. Please enter prices manually.',
    }));
  }
}
