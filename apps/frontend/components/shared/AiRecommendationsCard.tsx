"use client";

import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

export interface Recommendation {
  action: string;
  reason: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  href?: string;
}

interface AiRecommendationsCardProps {
  recommendations: Recommendation[];
}

const priorityStyles: Record<string, { dot: string; badge: string }> = {
  HIGH: { dot: "bg-red-500", badge: "bg-red-50 text-red-700" },
  MEDIUM: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700" },
  LOW: { dot: "bg-green-500", badge: "bg-green-50 text-green-700" },
};

export function AiRecommendationsCard({ recommendations }: AiRecommendationsCardProps) {
  if (!recommendations || recommendations.length === 0) return null;

  const top = recommendations[0];
  const rest = recommendations.slice(1, 4);
  const styles = priorityStyles[top.priority] ?? priorityStyles.LOW;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="h-6 w-6 rounded-full bg-[var(--color-accent)] flex items-center justify-center shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
        <h2 className="font-bold text-sm text-[var(--color-text-primary)]">AI Recommendations</h2>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-green-100 bg-[#F4FCF7] p-4 shadow-sm">
        {/* Top recommendation — featured */}
        <div className="flex items-start gap-3 pb-3 border-b border-green-100">
          <div className="h-10 w-10 rounded-full bg-[var(--color-accent)] flex items-center justify-center shrink-0 shadow-sm">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${styles.badge}`}>
                {top.priority}
              </span>
            </div>
            <p className="text-sm font-bold text-[var(--color-text-primary)] leading-tight">
              {top.action}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
              {top.reason}
            </p>
            {top.href && (
              <Link
                href={top.href}
                className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-[var(--color-accent)] hover:underline"
              >
                Take action <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>

        {/* Additional recommendations */}
        {rest.map((rec, i) => {
          const s = priorityStyles[rec.priority] ?? priorityStyles.LOW;
          return (
            <div key={i} className="flex items-start gap-3 py-2 border-b border-green-100 last:border-0 last:pb-0">
              <span className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${s.dot}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[var(--color-text-primary)]">{rec.action}</p>
                <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">{rec.reason}</p>
              </div>
              {rec.href && (
                <Link href={rec.href} className="text-[10px] font-bold text-[var(--color-accent)] hover:underline shrink-0">
                  Go →
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
