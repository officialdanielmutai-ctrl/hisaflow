export type AnalyticsPreset =
  | 'today'
  | 'yesterday'
  | '12h'
  | '24h'
  | '7d'
  | 'week'
  | 'last_week'
  | '30d'
  | 'month'
  | 'last_month'
  | 'year'
  | 'custom';

export type AnalyticsGranularity = 'hour' | 'day' | 'month';

export interface SeriesBucket {
  start: string;
  label: string;
  value: number;
  count: number;
}

export type ComparisonStatus = 'ok' | 'no_previous_data' | 'not_applicable';

export interface PeriodComparison {
  previousTotal: number;
  deltaPct: number | null;
  status: ComparisonStatus;
  periodLabel: string;
}

export interface ResolvedAnalyticsRange {
  preset: AnalyticsPreset;
  from: string;
  to: string;
  tz: 'Africa/Nairobi';
  granularity: AnalyticsGranularity;
  label: string;
  partialPeriod: boolean;
}

export interface DailyPerformancePoint {
  date: string;
  day: string;
  sales: number;
  expenses: number;
  salesCount: number;
  expensesCount: number;
}

export interface MetricDashboardResponse {
  metric: string;
  range: ResolvedAnalyticsRange;
  total: number;
  currency: string;
  buckets: SeriesBucket[];
  comparison: PeriodComparison;
  meta: {
    generatedAt: string;
    rowCount: number;
    partialPeriod: boolean;
    reconciled: boolean;
  };
}

/** Africa/Nairobi is fixed UTC+03:00 year-round (no DST). */
export const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
export const EAT_TZ = 'Africa/Nairobi' as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_SHORT_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_SHORT_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Exact 2-decimal rounding to avoid IEEE-754 accumulation noise on KES money. */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Shifts a UTC timestamp into pseudo-UTC wall-clock representation for EAT. */
function toEatWallClock(date: Date): Date {
  return new Date(date.getTime() + EAT_OFFSET_MS);
}

/** Returns YYYY-MM-DD in Africa/Nairobi for a UTC instant. */
export function toEatDateKey(date: Date): string {
  const eat = toEatWallClock(date);
  const y = eat.getUTCFullYear();
  const m = String(eat.getUTCMonth() + 1).padStart(2, '0');
  const d = String(eat.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Returns YYYY-MM in Africa/Nairobi for a UTC instant. */
export function toEatMonthKey(date: Date): string {
  const eat = toEatWallClock(date);
  const y = eat.getUTCFullYear();
  const m = String(eat.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Formats an instant as ISO-8601 with explicit +03:00 offset. */
export function formatEatIso(date: Date): string {
  const eat = toEatWallClock(date);
  const y = eat.getUTCFullYear();
  const mo = String(eat.getUTCMonth() + 1).padStart(2, '0');
  const d = String(eat.getUTCDate()).padStart(2, '0');
  const h = String(eat.getUTCHours()).padStart(2, '0');
  const mi = String(eat.getUTCMinutes()).padStart(2, '0');
  const s = String(eat.getUTCSeconds()).padStart(2, '0');
  return `${y}-${mo}-${d}T${h}:${mi}:${s}+03:00`;
}

/** Midnight-to-midnight bounds for an EAT calendar day (0 = today, -1 = yesterday). */
export function eatDayBounds(
  offsetDays = 0,
  now = new Date(),
): { start: Date; end: Date } {
  const eat = toEatWallClock(now);
  const start = new Date(
    Date.UTC(eat.getUTCFullYear(), eat.getUTCMonth(), eat.getUTCDate() + offsetDays) -
      EAT_OFFSET_MS,
  );
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** Monday-to-Monday bounds for an EAT ISO calendar week (0 = this week, -1 = last week). */
export function eatWeekBounds(
  offsetWeeks = 0,
  now = new Date(),
): { start: Date; end: Date } {
  const eat = toEatWallClock(now);
  const dayOfWeek = eat.getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const start = new Date(
    Date.UTC(
      eat.getUTCFullYear(),
      eat.getUTCMonth(),
      eat.getUTCDate() - daysSinceMonday + offsetWeeks * 7,
    ) - EAT_OFFSET_MS,
  );
  return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
}

/** Month bounds in EAT (0 = this month, -1 = last month). */
export function eatMonthBounds(
  offsetMonths = 0,
  now = new Date(),
): { start: Date; end: Date } {
  const eat = toEatWallClock(now);
  const start = new Date(
    Date.UTC(eat.getUTCFullYear(), eat.getUTCMonth() + offsetMonths, 1) -
      EAT_OFFSET_MS,
  );
  const end = new Date(
    Date.UTC(eat.getUTCFullYear(), eat.getUTCMonth() + offsetMonths + 1, 1) -
      EAT_OFFSET_MS,
  );
  return { start, end };
}

/** Year bounds in EAT (0 = this year). */
export function eatYearBounds(
  offsetYears = 0,
  now = new Date(),
): { start: Date; end: Date } {
  const eat = toEatWallClock(now);
  const start = new Date(
    Date.UTC(eat.getUTCFullYear() + offsetYears, 0, 1) - EAT_OFFSET_MS,
  );
  const end = new Date(
    Date.UTC(eat.getUTCFullYear() + offsetYears + 1, 0, 1) - EAT_OFFSET_MS,
  );
  return { start, end };
}

/** Greeting time-of-day evaluated strictly in Africa/Nairobi. */
export function eatTimeOfDay(
  now = new Date(),
): 'morning' | 'afternoon' | 'evening' {
  const hour = toEatWallClock(now).getUTCHours();
  if (hour >= 0 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  return 'evening';
}

function formatRangeDates(start: Date, endInclusive: Date): string {
  const s = toEatWallClock(start);
  const e = toEatWallClock(endInclusive);
  const sDay = s.getUTCDate();
  const sMon = MONTH_SHORT_NAMES[s.getUTCMonth()];
  const eDay = e.getUTCDate();
  const eMon = MONTH_SHORT_NAMES[e.getUTCMonth()];
  const eYear = e.getUTCFullYear();
  if (s.getUTCFullYear() === eYear && sMon === eMon && sDay === eDay) {
    return `${sDay} ${sMon} ${eYear}`;
  }
  return `${sDay} ${sMon} – ${eDay} ${eMon} ${eYear}`;
}

export interface ResolvedWindow {
  range: ResolvedAnalyticsRange;
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  previousLabel: string;
}

const VALID_PRESETS = new Set<string>([
  'today',
  'yesterday',
  '12h',
  '24h',
  '7d',
  'week',
  'last_week',
  '30d',
  'month',
  'last_month',
  'year',
  'custom',
]);

/**
 * Resolves a timeframe preset (plus optional custom ISO bounds) deterministically
 * in Africa/Nairobi, together with the matching non-overlapping comparison window.
 */
export function resolveAnalyticsRange(
  input: { preset?: string; from?: string; to?: string } = {},
  now = new Date(),
): ResolvedWindow {
  const rawPreset = VALID_PRESETS.has(input.preset ?? '')
    ? (input.preset as AnalyticsPreset)
    : 'today';

  if (rawPreset === 'custom' && input.from && input.to) {
    const parsedFrom = new Date(input.from);
    const parsedTo = new Date(input.to);
    if (
      !Number.isNaN(parsedFrom.getTime()) &&
      !Number.isNaN(parsedTo.getTime()) &&
      parsedTo.getTime() > parsedFrom.getTime()
    ) {
      const spanMs = parsedTo.getTime() - parsedFrom.getTime();
      const granularity: AnalyticsGranularity =
        spanMs <= 2 * DAY_MS ? 'hour' : spanMs > 92 * DAY_MS ? 'month' : 'day';
      const partialPeriod = parsedTo.getTime() >= now.getTime() - HOUR_MS;
      return {
        start: parsedFrom,
        end: parsedTo,
        previousStart: new Date(parsedFrom.getTime() - spanMs),
        previousEnd: parsedFrom,
        previousLabel: 'vs previous period',
        range: {
          preset: 'custom',
          from: formatEatIso(parsedFrom),
          to: formatEatIso(parsedTo),
          tz: EAT_TZ,
          granularity,
          label: formatRangeDates(parsedFrom, new Date(parsedTo.getTime() - 1)),
          partialPeriod,
        },
      };
    }
  }

  let start: Date;
  let end: Date;
  let previousStart: Date;
  let previousEnd: Date;
  let granularity: AnalyticsGranularity;
  let label: string;
  let previousLabel: string;
  let partialPeriod = true;

  switch (rawPreset) {
    case '12h': {
      end = now;
      start = new Date(now.getTime() - 12 * HOUR_MS);
      previousEnd = start;
      previousStart = new Date(start.getTime() - 12 * HOUR_MS);
      granularity = 'hour';
      label = 'Last 12 Hours';
      previousLabel = 'vs prior 12h';
      break;
    }
    case '24h': {
      end = now;
      start = new Date(now.getTime() - 24 * HOUR_MS);
      previousEnd = start;
      previousStart = new Date(start.getTime() - 24 * HOUR_MS);
      granularity = 'hour';
      label = 'Last 24 Hours';
      previousLabel = 'vs prior 24h';
      break;
    }
    case 'yesterday': {
      const y = eatDayBounds(-1, now);
      const prev = eatDayBounds(-2, now);
      start = y.start;
      end = y.end;
      previousStart = prev.start;
      previousEnd = prev.end;
      granularity = 'hour';
      label = `Yesterday (${formatRangeDates(start, new Date(end.getTime() - 1))})`;
      previousLabel = 'vs day before';
      partialPeriod = false;
      break;
    }
    case '7d': {
      const oldest = eatDayBounds(-6, now);
      const today = eatDayBounds(0, now);
      const prevOldest = eatDayBounds(-13, now);
      start = oldest.start;
      end = today.end;
      previousStart = prevOldest.start;
      previousEnd = oldest.start;
      granularity = 'day';
      label = `Last 7 Days (${formatRangeDates(start, now)})`;
      previousLabel = 'vs prior 7 days';
      break;
    }
    case 'week': {
      const curr = eatWeekBounds(0, now);
      const prev = eatWeekBounds(-1, now);
      start = curr.start;
      end = curr.end;
      previousStart = prev.start;
      previousEnd = prev.end;
      granularity = 'day';
      label = `This Week (${formatRangeDates(start, new Date(end.getTime() - 1))})`;
      previousLabel = 'vs last week';
      break;
    }
    case 'last_week': {
      const curr = eatWeekBounds(-1, now);
      const prev = eatWeekBounds(-2, now);
      start = curr.start;
      end = curr.end;
      previousStart = prev.start;
      previousEnd = prev.end;
      granularity = 'day';
      label = `Last Week (${formatRangeDates(start, new Date(end.getTime() - 1))})`;
      previousLabel = 'vs prior week';
      partialPeriod = false;
      break;
    }
    case '30d': {
      const oldest = eatDayBounds(-29, now);
      const today = eatDayBounds(0, now);
      const prevOldest = eatDayBounds(-59, now);
      start = oldest.start;
      end = today.end;
      previousStart = prevOldest.start;
      previousEnd = oldest.start;
      granularity = 'day';
      label = `Last 30 Days (${formatRangeDates(start, now)})`;
      previousLabel = 'vs prior 30 days';
      break;
    }
    case 'month': {
      const curr = eatMonthBounds(0, now);
      const prev = eatMonthBounds(-1, now);
      start = curr.start;
      end = curr.end;
      previousStart = prev.start;
      previousEnd = prev.end;
      granularity = 'day';
      const eat = toEatWallClock(start);
      label = `${MONTH_SHORT_NAMES[eat.getUTCMonth()]} ${eat.getUTCFullYear()}`;
      previousLabel = 'vs last month';
      break;
    }
    case 'last_month': {
      const curr = eatMonthBounds(-1, now);
      const prev = eatMonthBounds(-2, now);
      start = curr.start;
      end = curr.end;
      previousStart = prev.start;
      previousEnd = prev.end;
      granularity = 'day';
      const eat = toEatWallClock(start);
      label = `${MONTH_SHORT_NAMES[eat.getUTCMonth()]} ${eat.getUTCFullYear()}`;
      previousLabel = 'vs prior month';
      partialPeriod = false;
      break;
    }
    case 'year': {
      const curr = eatYearBounds(0, now);
      const prev = eatYearBounds(-1, now);
      start = curr.start;
      end = curr.end;
      previousStart = prev.start;
      previousEnd = prev.end;
      granularity = 'month';
      const eat = toEatWallClock(start);
      label = `${eat.getUTCFullYear()}`;
      previousLabel = 'vs last year';
      break;
    }
    case 'today':
    default: {
      const today = eatDayBounds(0, now);
      const yest = eatDayBounds(-1, now);
      start = today.start;
      end = today.end;
      previousStart = yest.start;
      previousEnd = yest.end;
      granularity = 'hour';
      label = `Today (${formatRangeDates(start, start)})`;
      previousLabel = 'vs yesterday';
      break;
    }
  }

  return {
    start,
    end,
    previousStart,
    previousEnd,
    previousLabel,
    range: {
      preset: rawPreset,
      from: formatEatIso(start),
      to: formatEatIso(end),
      tz: EAT_TZ,
      granularity,
      label,
      partialPeriod,
    },
  };
}

/**
 * Generates an explicit zero-filled sequence of buckets over [start, end) in EAT
 * and aggregates entries strictly by bucket without interpolation or gaps.
 */
export function buildZeroFilledSeries(
  start: Date,
  end: Date,
  granularity: AnalyticsGranularity,
  entries: Array<{ timestamp: Date; value: number }>,
): { buckets: SeriesBucket[]; total: number; rowCount: number } {
  const buckets: SeriesBucket[] = [];
  const indexByKey = new Map<string, number>();

  if (granularity === 'hour') {
    const startMs = Math.floor(start.getTime() / HOUR_MS) * HOUR_MS;
    const endMs = end.getTime();
    for (let cursor = startMs; cursor < endMs; cursor += HOUR_MS) {
      const d = new Date(cursor);
      const eat = toEatWallClock(d);
      const key = `${toEatDateKey(d)}T${String(eat.getUTCHours()).padStart(2, '0')}`;
      const label = `${String(eat.getUTCHours()).padStart(2, '0')}:00`;
      indexByKey.set(key, buckets.length);
      buckets.push({ start: formatEatIso(d), label, value: 0, count: 0 });
    }
    let rowCount = 0;
    for (const entry of entries) {
      const t = entry.timestamp.getTime();
      if (t < start.getTime() || t >= endMs) continue;
      const eat = toEatWallClock(entry.timestamp);
      const key = `${toEatDateKey(entry.timestamp)}T${String(eat.getUTCHours()).padStart(2, '0')}`;
      const idx = indexByKey.get(key);
      if (idx !== undefined) {
        buckets[idx].value = roundMoney(buckets[idx].value + entry.value);
        buckets[idx].count += 1;
        rowCount += 1;
      }
    }
    const total = roundMoney(buckets.reduce((s, b) => s + b.value, 0));
    return { buckets, total, rowCount };
  }

  if (granularity === 'month') {
    const startEat = toEatWallClock(start);
    const endEat = toEatWallClock(new Date(end.getTime() - 1));
    let year = startEat.getUTCFullYear();
    let month = startEat.getUTCMonth();
    const endYear = endEat.getUTCFullYear();
    const endMonth = endEat.getUTCMonth();

    while (year < endYear || (year === endYear && month <= endMonth)) {
      const d = new Date(Date.UTC(year, month, 1) - EAT_OFFSET_MS);
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      const label = `${MONTH_SHORT_NAMES[month]}`;
      indexByKey.set(key, buckets.length);
      buckets.push({ start: formatEatIso(d), label, value: 0, count: 0 });
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }

    let rowCount = 0;
    for (const entry of entries) {
      const t = entry.timestamp.getTime();
      if (t < start.getTime() || t >= end.getTime()) continue;
      const key = toEatMonthKey(entry.timestamp);
      const idx = indexByKey.get(key);
      if (idx !== undefined) {
        buckets[idx].value = roundMoney(buckets[idx].value + entry.value);
        buckets[idx].count += 1;
        rowCount += 1;
      }
    }
    const total = roundMoney(buckets.reduce((s, b) => s + b.value, 0));
    return { buckets, total, rowCount };
  }

  // Default: daily buckets in EAT
  const startEat = toEatWallClock(start);
  let cursor = new Date(
    Date.UTC(
      startEat.getUTCFullYear(),
      startEat.getUTCMonth(),
      startEat.getUTCDate(),
    ) - EAT_OFFSET_MS,
  );
  const endMs = end.getTime();
  const totalDays = Math.max(1, Math.ceil((endMs - cursor.getTime()) / DAY_MS));
  const useDayNames = totalDays <= 7;

  while (cursor.getTime() < endMs) {
    const eat = toEatWallClock(cursor);
    const key = toEatDateKey(cursor);
    const label = useDayNames
      ? DAY_SHORT_NAMES[eat.getUTCDay()]
      : `${eat.getUTCDate()} ${MONTH_SHORT_NAMES[eat.getUTCMonth()]}`;
    indexByKey.set(key, buckets.length);
    buckets.push({ start: formatEatIso(cursor), label, value: 0, count: 0 });
    cursor = new Date(cursor.getTime() + DAY_MS);
  }

  let rowCount = 0;
  for (const entry of entries) {
    const t = entry.timestamp.getTime();
    if (t < start.getTime() || t >= endMs) continue;
    const key = toEatDateKey(entry.timestamp);
    const idx = indexByKey.get(key);
    if (idx !== undefined) {
      buckets[idx].value = roundMoney(buckets[idx].value + entry.value);
      buckets[idx].count += 1;
      rowCount += 1;
    }
  }
  const total = roundMoney(buckets.reduce((s, b) => s + b.value, 0));
  return { buckets, total, rowCount };
}

/**
 * Computes honest previous-period comparison. When the previous period had
 * zero activity, deltaPct is null and status is 'no_previous_data' so the UI
 * never renders a misleading "+100%".
 */
export function computePeriodComparison(
  currentTotal: number,
  previousTotal: number,
  periodLabel: string,
): PeriodComparison {
  const prev = roundMoney(previousTotal);
  const curr = roundMoney(currentTotal);
  if (prev === 0) {
    return {
      previousTotal: 0,
      deltaPct: null,
      status: 'no_previous_data',
      periodLabel,
    };
  }
  const deltaPct = Math.round(((curr - prev) / Math.abs(prev)) * 100);
  return {
    previousTotal: prev,
    deltaPct,
    status: 'ok',
    periodLabel,
  };
}

/**
 * Extracts exact sale amount for an InventoryTransaction row, honoring tiered
 * prices stored in metadata.appliedTierPrice and avoiding ingredient/composite
 * double counting.
 */
export function effectiveTransactionSaleAmount(tx: {
  type?: string;
  quantityChange: unknown;
  reason?: string | null;
  metadata?: unknown;
  item: { sellingPrice?: unknown; isComposite?: boolean | null } | null;
}): number {
  const meta =
    tx.metadata && typeof tx.metadata === 'object'
      ? (tx.metadata as Record<string, unknown>)
      : null;

  // Exclude child ingredient deduction rows of composite/table-order sales
  const reason = tx.reason ?? '';
  if (reason.startsWith('Used in ') || reason.startsWith('Table order ')) {
    return 0;
  }

  // If TransactionsService stored precomputed amountTotal for a composite dish, use it
  if (meta && typeof meta.amountTotal === 'number' && Number.isFinite(meta.amountTotal)) {
    return roundMoney(meta.amountTotal);
  }

  const rawTierPrice = meta?.appliedTierPrice;
  const unitPrice =
    typeof rawTierPrice === 'number' && Number.isFinite(rawTierPrice)
      ? rawTierPrice
      : Number(tx.item?.sellingPrice ?? 0);

  const rawQty = Math.abs(Number(tx.quantityChange ?? 0));
  const compositeQty =
    rawQty === 0 && typeof meta?.compositeQuantity === 'number'
      ? Math.abs(meta.compositeQuantity)
      : rawQty;

  return roundMoney(compositeQty * unitPrice);
}

/**
 * Sums non-ingredient purchase cost for an InventoryTransaction row.
 */
export function effectiveTransactionPurchaseAmount(tx: {
  quantityChange: unknown;
  item: { costPrice?: unknown } | null;
}): number {
  const qty = Math.abs(Number(tx.quantityChange ?? 0));
  return roundMoney(qty * Number(tx.item?.costPrice ?? 0));
}
