"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface RecordPaymentSheetProps {
  invoiceId: string;
  totalExpected: number;
  amountPaid: number;
}

export function RecordPaymentSheet({ invoiceId, totalExpected, amountPaid }: RecordPaymentSheetProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const balance = totalExpected - amountPaid;
  
  const [formData, setFormData] = useState({
    amount: balance > 0 ? balance.toString() : "",
    method: "MPESA",
    reference: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        amount: parseFloat(formData.amount),
        method: formData.method,
        reference: formData.reference,
      };
      const res = await fetch(`/api/school-fees/invoice/${invoiceId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setOpen(false);
        window.location.reload();
      } else {
        console.error("Failed to record payment");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (balance <= 0) return null; // Fully paid

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="bg-[#1F7A5A] hover:bg-[#1A6B4E] text-white">Record Payment</Button>
      </SheetTrigger>
      <SheetContent className="bg-[#FAFAFA]">
        <SheetHeader>
          <SheetTitle>Record Payment</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="bg-muted p-4 rounded-md text-sm flex justify-between">
            <span>Balance Due:</span>
            <span className="font-bold text-destructive">KES {balance.toLocaleString()}</span>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="amount">Payment Amount</Label>
            <Input
              id="amount"
              type="number"
              required
              max={balance}
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="method">Payment Method</Label>
            <select
              id="method"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.method}
              onChange={(e) => setFormData({ ...formData, method: e.target.value })}
            >
              <option value="MPESA">M-Pesa</option>
              <option value="BANK">Bank Transfer</option>
              <option value="CASH">Cash</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">Reference / Transaction ID</Label>
            <Input
              id="reference"
              required
              placeholder="e.g. QWE123RTY4"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
            />
          </div>

          <Button type="submit" className="w-full bg-[#1F7A5A] hover:bg-[#1A6B4E] text-white" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Payment
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
