"use client";

import { useState, useEffect } from "react";
import { AddTermSheet } from "@/components/school/AddTermSheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

export default function SchoolFeesPage() {
  const [activeTab, setActiveTab] = useState("invoices");
  const [activeTerm, setActiveTerm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    async function fetchTerm() {
      try {
        const res = await fetch("/api/academic-terms/active");
        if (res.ok) {
          const data = await res.json();
          setActiveTerm(data);
        } else {
          setActiveTerm(null);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    fetchTerm();
  }, []);

  const handleGenerateInvoices = async () => {
    if (!activeTerm) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/school-fees/generate/${activeTerm.id}`, {
        method: "POST"
      });
      if (res.ok) {
        alert("Invoices generated successfully!");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">School Fees</h1>
          <p className="text-muted-foreground">Manage fee structures, terms, and invoices.</p>
        </div>
        <AddTermSheet />
      </div>

      {loading ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : activeTerm ? (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="text-sm font-medium text-primary mb-1">Active Term</div>
              <h2 className="text-2xl font-bold">{activeTerm.name}</h2>
              <div className="text-sm text-muted-foreground mt-1">
                {new Date(activeTerm.startDate).toLocaleDateString()} - {new Date(activeTerm.endDate).toLocaleDateString()}
              </div>
            </div>
            <Button onClick={handleGenerateInvoices} disabled={generating}>
              {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Invoices
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No active term found. Add an academic term to start managing fees.
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 border-b">
        {["invoices", "defaulters", "summary"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content Placeholder */}
      <div className="min-h-[300px]">
        {activeTab === "invoices" && (
          <Card>
            <CardHeader><CardTitle>All Invoices</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground">Invoice list will appear here.</p></CardContent>
          </Card>
        )}
        {activeTab === "defaulters" && (
          <Card>
            <CardHeader><CardTitle>Defaulters List</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground">Students with unpaid balances.</p></CardContent>
          </Card>
        )}
        {activeTab === "summary" && (
          <Card>
            <CardHeader><CardTitle>Term Summary</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground">Overall fee collection statistics.</p></CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
