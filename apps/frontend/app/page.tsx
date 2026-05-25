import AppShell from '@/components/layout/AppShell'
import AlertCard from '@/components/system/AlertCard'
import InventoryCard from '@/components/system/InventoryCard'
import OperationalSummary from '@/components/system/OperationalSummary'

export default function Home() {
  return (
    <AppShell businessName="Demo Business" activeTab="home">
      <div className="flex flex-col gap-4">
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
            Needs Attention
          </p>
          <div className="flex flex-col gap-3">
            <AlertCard
              severity="critical"
              title="Rice stock critical"
              description="Current stock will run out in approximately 2 days based on recent sales."
              actionLabel="Restock now"
            />
            <AlertCard
              severity="warning"
              title="Cooking oil running low"
              description="Stock is below reorder threshold. Consider placing an order soon."
              actionLabel="View stock"
            />
          </div>
        </section>
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
            Today
          </p>
          <div className="grid grid-cols-2 gap-3">
            <OperationalSummary
              label="Sales"
              value="KES 4,200"
              trend="up"
              trendLabel="vs yesterday"
            />
            <OperationalSummary
              label="Low stock"
              value="3 items"
              trend="down"
              trendLabel="needs action"
            />
          </div>
        </section>
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
            Inventory
          </p>
          <div className="flex flex-col gap-3">
            <InventoryCard
              name="Unga wa Dọuma"
              quantity={4}
              unit="bags"
              status="critical"
              category="Dry goods"
            />
            <InventoryCard
              name="Cooking Oil 1L"
              quantity={12}
              unit="bottles"
              status="warning"
              category="Oils"
            />
            <InventoryCard
              name="Sugar 1kg"
              quantity={28}
              unit="packets"
              status="success"
              category="Dry goods"
            />
          </div>
        </section>
      </div>
    </AppShell>
  )
}
