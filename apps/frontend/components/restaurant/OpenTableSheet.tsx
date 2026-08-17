"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface OpenTableSheetProps {
  children: React.ReactNode;
  onOpenSuccess: () => void;
}

export function OpenTableSheet({ children, onOpenSuccess }: OpenTableSheetProps) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/table-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableLabel: label, notes }),
      });
      if (!res.ok) throw new Error("Failed to open table");
      
      setOpen(false);
      setLabel("");
      setNotes("");
      onOpenSuccess();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent className="bg-[#FAFAFA]">
        <SheetHeader>
          <SheetTitle>Open New Table</SheetTitle>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          {error && <div className="text-red-500 text-sm">{error}</div>}
          
          <div className="space-y-2">
            <Label htmlFor="table-label">Table Label</Label>
            <Input 
              id="table-label" 
              placeholder="e.g. Table 4" 
              value={label} 
              onChange={(e) => setLabel(e.target.value)} 
              required 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="table-notes">Notes (Optional)</Label>
            <Input 
              id="table-notes" 
              placeholder="e.g. Near window" 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
            />
          </div>

          <Button type="submit" className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 bg-[#1F7A5A] hover:bg-[#1A6B4E] text-white" disabled={loading || !label.trim()}>
            {loading ? "Opening..." : "Open Table"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
