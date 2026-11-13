"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMyOrganization } from "@/hooks/useMyOrganization";
import { apiGet, apiPost } from "@/lib/api-client";
import { AddTermSheet } from "@/components/school/AddTermSheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, CalendarDays, CheckCircle2 } from "lucide-react";
import useSWR from "swr";

interface AcademicTerm {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  dueDate?: string;
  isActive: boolean;
  _count?: { feeStructures: number };
}

interface FeeInvoiceRow {
  id: string;
  status: 'DRAFT' | 'ISSUED' | 'PARTIAL' | 'PAID' | 'VOIDED';
  totalExpected: number;
  adjustmentsTotal: number;
  amountPaid: number;
  student?: {
    id: string;
    name: string;
    class?: { name: string } | null;
  };
}

interface DefaulterRow {
  studentId: string;
  studentName: string;
  className?: string | null;
  amountPaid: number;
  totalExpected: number;
  balance: number;
  status: string;
}

interface TermSummary {
  totalExpected: number;
  totalCollected: number;
  outstanding: number;
  collectionRate: number;
  byClass: {
    className: string;
    totalExpected: number;
    totalCollected: number;
    studentCount: number;
  }[];
}

export default function SchoolFeesPage() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const orgId = membership?.organization.id;

  const [activeTab, setActiveTab] = useState("terms");
  const [activating, setActivating] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const { data: terms, isLoading, mutate } = useSWR<AcademicTerm[]>(
    orgId ? ["academic-terms", orgId] : null,
    async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return apiGet<AcademicTerm[]>("/academic-terms", token, orgId!);
    }
  );

  const activeTerm = terms?.find((t) => t.isActive) ?? null;

  const { data: termInvoices, isLoading: invoicesLoading, mutate: mutateInvoices } =
    useSWR<FeeInvoiceRow[]>(
      orgId && activeTerm && activeTab === "invoices"
        ? ["fee-invoices", orgId, activeTerm.id]
        : null,
      async () => {
        const token = await getToken();
        if (!token || !orgId || !activeTerm) throw new Error("Not authenticated");
        return apiGet<FeeInvoiceRow[]>(
          `/school-fees/term/${activeTerm.id}`,
          token,
          orgId
        );
      }
    );

  const { data: defaulters, isLoading: defaultersLoading } = useSWR<
    DefaulterRow[]
  >(
    orgId && activeTerm && activeTab === "defaulters"
      ? ["fee-defaulters", orgId, activeTerm.id]
      : null,
    async () => {
      const token = await getToken();
      if (!token || !orgId || !activeTerm) throw new Error("Not authenticated");
      return apiGet<DefaulterRow[]>(
        `/school-fees/term/${activeTerm.id}/defaulters`,
        token,
        orgId
      );
    }
  );

  const { data: termSummary, isLoading: summaryLoading } = useSWR<TermSummary>(
    orgId && activeTerm && activeTab === "summary"
      ? ["fee-summary", orgId, activeTerm.id]
      : null,
    async () => {
      const token = await getToken();
      if (!token || !orgId || !activeTerm) throw new Error("Not authenticated");
      return apiGet<TermSummary>(
        `/school-fees/term/${activeTerm.id}/summary`,
        token,
        orgId
      );
    }
  );

  const handleIssueInvoice = async (invoiceId: string) => {
    if (!orgId) return;
    try {
      const token = await getToken();
      if (!token) return;
      await apiPost(
        `/school-fees/invoice/${invoiceId}/issue`,
        token,
        orgId,
        {}
      );
      await mutateInvoices();
    } catch (error) {
      console.error(error);
    }
  };

  const handleActivate = async (termId: string) => {
    if (!membership) return;
    setActivating(termId);
    try {
      const token = await getToken();
      if (!token) return;
      await apiPost(
        `/academic-terms/${termId}/activate`,
        token,
        membership.organization.id,
        {}
      );
      await mutate();
    } catch (err) {
      console.error(err);
    } finally {
      setActivating(null);
    }
  };

  const handleGenerateInvoices = async () => {
    if (!activeTerm || !membership) return;
    setGenerating(true);
    try {
      const token = await getToken();
      if (!token) return;
      await apiPost(
        `/school-fees/generate/${activeTerm.id}`,
        token,
        membership.organization.id,
        {}
      );
      alert("Invoices generated successfully!");
    } catch (error) {
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">School Fees</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Manage fee structures, terms, and invoices.
          </p>
        </div>
        <AddTermSheet onSuccess={() => mutate()} />
      </div>

      {/* Active Term Banner */}
      {isLoading ? (
        <Skeleton className="h-24 w-full rounded-2xl" />
      ) : activeTerm ? (
        <Card className="border-[#1F7A5A]/20 bg-[#1F7A5A]/5 rounded-2xl">
          <CardContent className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#1F7A5A]/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 text-[#1F7A5A]" />
              </div>
              <div>
                <div className="text-xs font-semibold text-[#1F7A5A] uppercase tracking-wide mb-0.5">
                  Active Term
                </div>
                <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                  {activeTerm.name}
                </h2>
                <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  {new Date(activeTerm.startDate).toLocaleDateString()} â€“{" "}
                  {new Date(activeTerm.endDate).toLocaleDateString()}
                </div>
              </div>
            </div>
            <Button
              onClick={handleGenerateInvoices}
              disabled={generating}
              className="bg-[#1F7A5A] hover:bg-[#1A6B4E] text-white shrink-0"
            >
              {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Invoices
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="p-8 text-center text-[var(--color-text-secondary)] text-sm">
            No active term found. Save a term and press <strong>Activate</strong> to start managing fees.
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 border-b border-[var(--color-border)]">
        {["terms", "invoices", "defaulters", "summary"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-[#1F7A5A] text-[#1F7A5A]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {/* Terms List */}
        {activeTab === "terms" && (
          <div className="flex flex-col gap-3">
            {isLoading && (
              <>
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                ))}
              </>
            )}
            {!isLoading && (!terms || terms.length === 0) && (
              <Card className="rounded-2xl">
                <CardContent className="p-8 text-center text-[var(--color-text-secondary)] text-sm">
                  No terms yet. Add your first academic term above.
                </CardContent>
              </Card>
            )}
            {!isLoading &&
              terms &&
              terms.map((term) => (
                <div
                  key={term.id}
                  className={`flex items-center gap-4 rounded-2xl border p-4 bg-[var(--color-bg-surface)] shadow-sm ${
                    term.isActive
                      ? "border-[#1F7A5A]/30"
                      : "border-[var(--color-border)]"
                  }`}
                >
                  <div className="h-10 w-10 rounded-xl bg-[var(--color-bg-muted)] flex items-center justify-center shrink-0">
                    <CalendarDays className="h-5 w-5 text-[var(--color-text-secondary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                        {term.name}
                      </h3>
                      {term.isActive && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#1F7A5A]/10 text-[#1F7A5A]">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      {new Date(term.startDate).toLocaleDateString()} â€“{" "}
                      {new Date(term.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  {!term.isActive && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={activating === term.id}
                      onClick={() => handleActivate(term.id)}
                      className="shrink-0"
                    >
                      {activating === term.id && (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      )}
                      Activate
                    </Button>
                  )}
                </div>
              ))}
          </div>
        )}

        {activeTab === "invoices" && (
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">All Invoices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!activeTerm ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Activate a term to see its invoices.
                </p>
              ) : invoicesLoading ? (
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading invoices…
                </div>
              ) : !termInvoices || termInvoices.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  No invoices for this term yet. Generate invoices above.
                </p>
              ) : (
                termInvoices.map((invoice) => {
                  const expected =
                    Number(invoice.totalExpected) -
                    Number(invoice.adjustmentsTotal ?? 0);
                  const paid = Number(invoice.amountPaid);
                  return (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] p-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                          {invoice.student?.name ?? "Student"}
                        </div>
                        <div className="text-xs text-[var(--color-text-secondary)]">
                          {invoice.student?.class?.name ?? "Unassigned"} ·{" "}
                          {invoice.status}
                        </div>
                      </div>
                      <div className="text-right text-xs">
                        <div>
                          KES {expected.toLocaleString()} expected
                        </div>
                        <div className="text-[var(--color-text-secondary)]">
                          KES {paid.toLocaleString()} paid · KES{" "}
                          {Math.max(expected - paid, 0).toLocaleString()} balance
                        </div>
                      </div>
                      {invoice.status === "DRAFT" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleIssueInvoice(invoice.id)}
                        >
                          Issue
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}
        {activeTab === "defaulters" && (
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Defaulters List</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!activeTerm ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Activate a term to see defaulters.
                </p>
              ) : defaultersLoading ? (
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading defaulters…
                </div>
              ) : !defaulters || defaulters.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Every student has cleared their fees for this term.
                </p>
              ) : (
                defaulters.map((row) => (
                  <div
                    key={row.studentId}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] p-3"
                  >
                    <div>
                      <div className="text-sm font-semibold">{row.studentName}</div>
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        {row.className ?? "Unassigned"} · {row.status}
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold text-destructive">
                        KES {Number(row.balance).toLocaleString()}
                      </div>
                      <div className="text-[var(--color-text-secondary)]">
                        of KES {Number(row.totalExpected).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}
        {activeTab === "summary" && (
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Term Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!activeTerm ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Activate a term to see its summary.
                </p>
              ) : summaryLoading ? (
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading summary…
                </div>
              ) : !termSummary ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  No fee data for this term yet.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl bg-[var(--color-bg-muted)] p-3">
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        Expected
                      </div>
                      <div className="text-base font-bold">
                        KES{" "}
                        {Number(termSummary.totalExpected).toLocaleString()}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[var(--color-bg-muted)] p-3">
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        Collected
                      </div>
                      <div className="text-base font-bold text-[#1F7A5A]">
                        KES{" "}
                        {Number(termSummary.totalCollected).toLocaleString()}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[var(--color-bg-muted)] p-3">
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        Outstanding
                      </div>
                      <div className="text-base font-bold text-destructive">
                        KES{" "}
                        {Number(termSummary.outstanding).toLocaleString()}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[var(--color-bg-muted)] p-3">
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        Collection
                      </div>
                      <div className="text-base font-bold">
                        {Number(termSummary.collectionRate).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {termSummary.byClass.map((row) => (
                      <div
                        key={row.className}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] p-3 text-sm"
                      >
                        <div>
                          <div className="font-semibold">{row.className}</div>
                          <div className="text-xs text-[var(--color-text-secondary)]">
                            {row.studentCount} invoice
                            {row.studentCount === 1 ? "" : "s"}
                          </div>
                        </div>
                        <div className="text-right text-xs">
                          <div>
                            KES{" "}
                            {Number(row.totalCollected).toLocaleString()} of KES{" "}
                            {Number(row.totalExpected).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
