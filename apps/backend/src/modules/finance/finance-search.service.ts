import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { FinanceBreakdownService } from './finance-breakdown.service';

export type FinanceAttributeType =
  | 'REVENUE'
  | 'EXPENSE'
  | 'LEAK'
  | 'CREDIT'
  | 'LEDGER';

/**
 * One searchable financial attribute of the business: a revenue source
 * (room/plan/class/commodity), an expense, a leak, an unpaid credit, or a
 * manual ledger entry. The explorer lets a user search these the same way the
 * commodity breakdown lets them search an item.
 */
export interface FinanceAttribute {
  id: string;
  type: FinanceAttributeType;
  label: string;
  subtitle: string | null;
  amount: number;
  sharePct: number | null;
  detail: string | null;
}

export interface FinanceSearchResult {
  businessType: string;
  period: 'rolling30' | 'calendar';
  totalMatched: number;
  results: FinanceAttribute[];
}

@Injectable()
export class FinanceSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly breakdown: FinanceBreakdownService,
  ) {}

  async search(
    organizationId: string,
    query: string,
    dateMode: 'rolling30' | 'calendar' = 'rolling30',
  ): Promise<FinanceSearchResult> {
    const { start, end } = this.getDateRange(dateMode);
    const snapshot = await this.breakdown.getBreakdown(organizationId, start, end);

    const attributes: FinanceAttribute[] = [];
    const revenueTotal = snapshot.revenue;
    const expenseTotal = snapshot.operatingExpenses;

    // Revenue / expense / maintenance attributes come from the same
    // vertical-aware breakdown the rest of Finance uses.
    for (const group of snapshot.breakdowns) {
      if (group.key === 'revenue-source' || group.key === 'revenue-mix') {
        for (const row of group.rows) {
          attributes.push({
            id: `revenue:${group.key}:${row.key}`,
            type: 'REVENUE',
            label: row.label,
            subtitle: group.title,
            amount: row.amount,
            sharePct: this.share(row.amount, revenueTotal),
            detail: null,
          });
        }
      } else if (
        group.key === 'expenses-by-category' ||
        group.key === 'maintenance-by-room'
      ) {
        for (const row of group.rows) {
          attributes.push({
            id: `expense:${group.key}:${row.key}`,
            type: 'EXPENSE',
            label: row.label,
            subtitle: group.title,
            amount: row.amount,
            sharePct: this.share(row.amount, expenseTotal),
            detail: null,
          });
        }
      }
    }

    for (const leak of snapshot.leaks) {
      attributes.push({
        id: `leak:${leak.key}`,
        type: 'LEAK',
        label: leak.label,
        subtitle: 'Money leak',
        amount: leak.amount,
        sharePct: null,
        detail: leak.detail ?? null,
      });
    }

    const [credits, ledger] = await Promise.all([
      this.prisma.db.creditRecord.findMany({
        where: { organizationId, status: { in: ['UNPAID', 'PARTIAL'] } },
        orderBy: { amountTotal: 'desc' },
        take: 100,
      }),
      this.prisma.db.businessTransaction.findMany({
        where: { organizationId, date: { gte: start, lte: end } },
        orderBy: { date: 'desc' },
        take: 200,
      }),
    ]);

    for (const credit of credits) {
      attributes.push({
        id: `credit:${credit.id}`,
        type: 'CREDIT',
        label: credit.clientName,
        subtitle: 'Unpaid customer credit',
        amount: Math.max(0, Number(credit.amountTotal) - Number(credit.amountPaid)),
        sharePct: null,
        detail: credit.notes ?? null,
      });
    }

    for (const entry of ledger) {
      attributes.push({
        id: `ledger:${entry.id}`,
        type: 'LEDGER',
        label: entry.category,
        subtitle: entry.description ?? entry.staffName ?? entry.type,
        amount: Number(entry.amount),
        sharePct: null,
        detail:
          entry.date instanceof Date
            ? entry.date.toISOString().slice(0, 10)
            : String(entry.date),
      });
    }

    const needle = query.trim().toLowerCase();
    const matched = needle
      ? attributes.filter((attribute) =>
          [attribute.label, attribute.subtitle, attribute.detail].some((value) =>
            (value ?? '').toLowerCase().includes(needle),
          ),
        )
      : attributes;

    matched.sort((a, b) => b.amount - a.amount);

    return {
      businessType: snapshot.businessType,
      period: dateMode,
      totalMatched: matched.length,
      results: matched.slice(0, 25),
    };
  }

  private share(amount: number, total: number): number | null {
    if (!total || total <= 0) return null;
    return Math.round((amount / total) * 1000) / 10;
  }

  private getDateRange(dateMode: 'rolling30' | 'calendar'): { start: Date; end: Date } {
    const now = new Date();
    if (dateMode === 'calendar') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }
    return { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end: now };
  }
}
