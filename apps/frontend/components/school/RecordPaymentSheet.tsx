"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMyOrganization } from "@/hooks/useMyOrganization";
import { apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface RecordPaymentSheetProps {
  invoiceId: string;
  totalExpected: number;
  amountPaid: number;
  onSuccess?: () => void;
}

export function RecordPaymentSheet({
  invoiceId,
  totalExpected,
  amountPaid,
  onSuccess,
}: RecordPaymentSheetProps) {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const balance = totalExpected - amountPaid;

  const [formData, setFormData] = useState({
    amount: balance > 0 ? balance.toString() : "",
    method: "MPESA",
    reference: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!membership) return;
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      await apiPost(
        `/school-fees/invoice/${invoiceId}/payments`,
        token,
        membership.organization.id,
        {
          amount: parseFloat(formData.amount),
          method: formData.method,
          reference: formData.reference,
        }
      );
      setOpen(false);
      onSuccess?.();
      window.location.reload();
    } catch (err: any) {
      setError(err.message || "Failed to record payment");
    } finally {
      setLoading(false);
    }
  };

  if (balance <= 0) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="bg-[#1F7A5A] hover:bg-[#1A6B4E] text-white">
          Record Payment
        </Button>
      </SheetTrigger>
      <SheetContent className="bg-[#FAFAFA] flex flex-col overflow-hidden">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <SheetTitle className="text-lg font-semibold">Record Payment</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {error && (
            <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl">
              {error}
            </div>
          )}
          <form id="record-payment-form" onSubmit={handleSubmit} className="space-y-5">
            <div className="bg-muted p-4 rounded-xl text-sm flex justify-between">
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
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          </form>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 bg-[#F5F5F5] flex-shrink-0">
          <Button
            type="submit"
            form="record-payment-form"
            className="w-full bg-[#1F7A5A] hover:bg-[#1A6B4E] text-white"
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Payment
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
