export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse pb-4">
      {/* ── Greeting Skeleton ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="h-7 w-48 rounded-md bg-muted" />
        <div className="h-4 w-32 rounded-md bg-muted" />
      </div>

      {/* ── KPI Grid Skeleton ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm h-28">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
              <div className="flex flex-col gap-1.5 w-full">
                <div className="h-3 w-16 rounded bg-muted" />
                <div className="h-6 w-12 rounded bg-muted" />
              </div>
            </div>
            <div className="h-2 w-24 rounded bg-muted mt-auto" />
          </div>
        ))}
      </div>

      {/* ── Section Skeleton ──────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="h-5 w-32 rounded bg-muted" />
          <div className="h-4 w-16 rounded bg-muted" />
        </div>
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 h-20"
            >
              <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
              <div className="flex flex-col gap-2 flex-1">
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
