import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { inventoryDisplayName } from '../../inventory/inventory-display-name';

export interface ResolvedItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  sellingPrice?: number;
  costPrice?: number;
  score: number;
}

export interface ResolutionResult {
  bestMatch: ResolvedItem | null;
  candidates: ResolvedItem[];
  confidence: 'high' | 'medium' | 'low';
}

/** Common English / Swahili / Sheng synonyms for Kenyan retail & commerce. */
const SYNONYMS: Record<string, string[]> = {
  unga: ['maize flour', 'flour', 'wheat flour', 'sembe', 'posho', 'corn flour'],
  sembe: ['maize flour', 'unga', 'posho'],
  posho: ['maize flour', 'unga'],
  sukari: ['sugar', 'shukari'],
  shukari: ['sugar'],
  maziwa: ['milk', 'fresh milk', 'lala', 'mala'],
  lala: ['milk', 'maziwa lala'],
  mala: ['milk', 'maziwa mala'],
  mkate: ['bread'],
  mafuta: ['cooking oil', 'oil', 'salad', 'salit'],
  salit: ['cooking oil', 'oil'],
  sabuni: ['soap', 'detergent', 'bar soap', 'omo'],
  omo: ['detergent', 'soap'],
  chumvi: ['salt'],
  mayai: ['eggs', 'egg'],
  mchele: ['rice'],
  mchelewe: ['rice'],
  sigara: ['cigarette', 'cigarettes', 'smokes'],
  panadol: ['paracetamol', 'painkiller', 'pain relief'],
  'mara moja': ['paracetamol', 'painkiller'],
  pampers: ['diapers', 'baby diapers'],
  dawa: ['medicine', 'drugs'],
  stima: ['electricity', 'tokens', 'kplc'],
  kredo: ['airtime', 'credit', 'scratch card'],
  airtime: ['kredo', 'scratch card'],
  chai: ['tea', 'tea leaves'],
  kahawa: ['coffee'],
  nyama: ['meat', 'beef'],
  kuku: ['chicken'],
  samaki: ['fish'],
};

/** Common package/unit suffixes to strip when normalising product query. */
const UNIT_REGEX = /\b(\d+(?:\.\d+)?\s*(?:kg|g|l|ml|litre|litres|liter|liters|pkt|pkts|packet|packets|bag|bags|pcs|piece|pieces|sachet|sachets|dozen|box|boxes|tin|tins|bottle|bottles))\b/gi;

function cleanString(input: string): string {
  return input
    .toLowerCase()
    .replace(UNIT_REGEX, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Simple Levenshtein distance for fuzzy typo matching. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const row = new Array(n + 1).fill(0).map((_, i) => i);

  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = row[j];
      if (a[i - 1] === b[j - 1]) {
        row[j] = prev;
      } else {
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + 1);
      }
      prev = temp;
    }
  }

  return row[n];
}

/** Fuzzy score between 0.0 and 1.0 based on Levenshtein distance. */
function fuzzySimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshtein(a, b);
  return Math.max(0, 1 - dist / maxLen);
}

@Injectable()
export class EntityResolutionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve an inventory item query against the organisation's catalog.
   * Handles typos, Swahili/Sheng terms, plurals, and partial substrings.
   */
  async resolveInventoryItem(
    organizationId: string,
    rawQuery: string,
    limit = 5,
  ): Promise<ResolutionResult> {
    const query = rawQuery.trim();
    if (!query) {
      return { bestMatch: null, candidates: [], confidence: 'low' };
    }

    const cleanedQuery = cleanString(query);
    const queryTokens = cleanedQuery.split(' ').filter(Boolean);

    // Expand query with known synonyms (e.g. unga -> maize flour)
    const expandedTerms = new Set<string>([cleanedQuery, ...queryTokens]);
    for (const [key, syns] of Object.entries(SYNONYMS)) {
      if (cleanedQuery.includes(key) || queryTokens.includes(key)) {
        for (const syn of syns) {
          expandedTerms.add(syn);
          cleanString(syn).split(' ').forEach((t) => expandedTerms.add(t));
        }
      }
    }

    // Fetch active inventory items for this organisation
    const items = await this.prisma.db.inventoryItem.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        unit: true,
        quantity: true,
        sellingPrice: true,
        costPrice: true,
        product: { select: { name: true } },
      },
      take: 200,
    });

    if (items.length === 0) {
      return { bestMatch: null, candidates: [], confidence: 'low' };
    }

    // Score each item against the query and expansions
    const scored: ResolvedItem[] = [];

    for (const item of items) {
      const displayName = inventoryDisplayName(item);
      const cleanedTarget = cleanString(displayName);
      const targetTokens = cleanedTarget.split(' ').filter(Boolean);

      let score = 0;

      // 1. Exact match
      if (displayName.toLowerCase() === query.toLowerCase() || cleanedTarget === cleanedQuery) {
        score = 1.0;
      }
      // 2. Full word or contains match
      else if (cleanedTarget.includes(cleanedQuery) && cleanedQuery.length >= 3) {
        // Higher score if whole phrase is found
        score = 0.90 + (cleanedQuery.length / cleanedTarget.length) * 0.08;
      } else if (cleanedQuery.includes(cleanedTarget) && cleanedTarget.length >= 3) {
        score = 0.88;
      }
      // 3. Synonym matching
      else {
        let maxSynScore = 0;
        for (const term of expandedTerms) {
          if (term.length < 3) continue;
          if (cleanedTarget.includes(term)) {
            maxSynScore = Math.max(maxSynScore, 0.85);
          } else {
            // Check token match
            for (const tToken of targetTokens) {
              if (tToken === term) {
                maxSynScore = Math.max(maxSynScore, 0.82);
              } else if (tToken.includes(term) || term.includes(tToken)) {
                maxSynScore = Math.max(maxSynScore, 0.75);
              }
            }
          }
        }

        if (maxSynScore > 0) {
          score = maxSynScore;
        } else {
          // 4. Token overlap scoring
          const matchedTokens = queryTokens.filter(
            (q) => q.length >= 2 && targetTokens.some((t) => t.includes(q) || q.includes(t)),
          );
          if (queryTokens.length > 0 && matchedTokens.length > 0) {
            score = 0.65 * (matchedTokens.length / queryTokens.length);
          }

          // 5. Fuzzy typo match
          if (score < 0.60 && cleanedQuery.length >= 4) {
            const fuzzy = Math.max(
              fuzzySimilarity(cleanedQuery, cleanedTarget),
              ...targetTokens.map((t) => fuzzySimilarity(cleanedQuery, t)),
            );
            if (fuzzy >= 0.60) {
              score = Math.max(score, 0.75 + (fuzzy - 0.60) * 0.4);
            }
          }
        }
      }

      if (score >= 0.50) {
        scored.push({
          id: item.id,
          name: displayName,
          unit: item.unit,
          quantity: Number(item.quantity),
          sellingPrice: item.sellingPrice ? Number(item.sellingPrice) : undefined,
          costPrice: item.costPrice ? Number(item.costPrice) : undefined,
          score: Math.round(score * 100) / 100,
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const candidates = scored.slice(0, limit);

    if (candidates.length === 0) {
      return { bestMatch: null, candidates: [], confidence: 'low' };
    }

    const top = candidates[0];
    const runnerUp = candidates[1];

    // If there is a tie or close runner-up, it is ambiguous -> bestMatch is null
    if (runnerUp && (top.score - runnerUp.score < 0.10 || runnerUp.score >= 0.85)) {
      return { bestMatch: null, candidates, confidence: 'medium' };
    }

    if (top.score >= 0.75) {
      return { bestMatch: top, candidates, confidence: top.score >= 0.85 ? 'high' : 'medium' };
    }

    return { bestMatch: null, candidates, confidence: 'low' };
  }
}
