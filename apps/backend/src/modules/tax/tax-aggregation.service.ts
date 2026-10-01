import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { EntitlementsService } from '../../core/entitlements/entitlements.service';
import { TierFeature } from '../../core/entitlements/entitlements.constant';
import {
  aggregateByLocation,
  TaxLocationSummary,
  UNASSIGNED_LOCATION,
} from './tax-aggregation';
import {
  daysBetween,
  filingDeadlineFor,
  resolvePeriod,
  TaxPeriod,
} from './tax-period';

export interface TaxAggregateView {
  period: TaxPeriod;
  filingDeadline: Date;
  /** Negative means the deadline has passed. */
  daysUntilDeadline: number;
  locationCount: number;
  locations: TaxLocationSummary[];
  totals: TaxLocationSummary;
  generatedAt: Date;
}

/**
 * Phase F — aggregated tax view across an org's locations.
 *
 * Reuses the existing Growth multi-location capability (the same
 * `TierFeature.MultiLocation` the 2nd ISP router is gated by) instead of a
 * tax-specific concept; the location dimension itself comes from the existing
 * `Router` (ISP POP) via `Invoice.subscriber.router`.
 */
@Injectable()
export class TaxAggregationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async getAggregatedView(
    organizationId: string,
    range?: { from?: string; to?: string },
  ): Promise<TaxAggregateView> {
    // Same gate as the ISP vertical's second router. A Solo/Team org is routed
    // to the paywall (`?feature=multi-location`).
    await this.entitlements.assertFeatures(organizationId, [
      TierFeature.MultiLocation,
    ]);

    const period = resolvePeriod(range);

    const records = await this.prisma.db.taxInvoiceRecord.findMany({
      where: {
        organizationId,
        createdAt: { gte: period.from, lt: period.to },
      },
      include: {
        invoice: {
          select: {
            subscriber: {
              select: { router: { select: { label: true } } },
            },
          },
        },
      },
    });

    const { locations, totals } = aggregateByLocation(
      records.map((record) => ({
        location:
          record.invoice.subscriber?.router?.label ?? UNASSIGNED_LOCATION,
        status: record.status,
        netAmount: Number(record.netAmount),
        taxAmount: Number(record.taxAmount),
        grossAmount: Number(record.grossAmount),
      })),
    );

    const filingDeadline = filingDeadlineFor(period.to);

    return {
      period,
      filingDeadline,
      daysUntilDeadline: daysBetween(new Date(), filingDeadline),
      locationCount: locations.length,
      locations,
      totals,
      generatedAt: new Date(),
    };
  }
}
