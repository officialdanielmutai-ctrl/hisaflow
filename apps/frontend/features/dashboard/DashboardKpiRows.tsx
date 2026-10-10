import { StatCard, type StatCardConfig } from '@/components/system/StatCard';

/**
 * Renders a vertical's KPI arrangement (overhaul Duty 1, Section 2.5).
 *
 * The *card* is shared (`StatCard`); each business type supplies only the list
 * of cards, their order, and their grid span. Keeping the mapping in one place
 * means a spacing/span fix lands in every vertical instead of one dashboard.
 *
 * A row is its own grid so siblings in the same visual row stretch to equal
 * height, which is what the geometry guard measures.
 */
export function DashboardKpiRows<TData>({
  rows,
  data,
}: {
  rows: StatCardConfig<TData>[][];
  data: TData;
}) {
  return (
    <div className="flex flex-col gap-4">
      {rows.map((row, rowIndex) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={rowIndex}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          {row.map((card) => (
            <StatCard
              key={card.id}
              label={card.label}
              icon={card.icon}
              iconTone={card.iconTone}
              cardTone={card.cardTone}
              variant={card.variant}
              href={card.href}
              className={card.span === 2 ? 'sm:col-span-2' : undefined}
              {...card.build(data)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default DashboardKpiRows;
