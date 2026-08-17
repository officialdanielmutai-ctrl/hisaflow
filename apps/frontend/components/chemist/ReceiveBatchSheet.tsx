"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ReceiveBatchSheet({ itemId, children }: { itemId: string, children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/stock-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          batchNumber,
          expiryDate,
          quantity: Number(quantity),
          costPrice: costPrice ? Number(costPrice) : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to receive batch");
      
      setOpen(false);
      setBatchNumber("");
      setExpiryDate("");
      setQuantity("");
      setCostPrice("");
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
          <SheetTitle>Receive New Batch</SheetTitle>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          {error && <div className="text-red-500 text-sm">{error}</div>}
          
          <div className="space-y-2">
            <Label htmlFor="batch-number">Batch Number</Label>
            <Input 
              id="batch-number" 
              placeholder="e.g. BATCH-2026-08" 
              value={batchNumber} 
              onChange={(e) => setBatchNumber(e.target.value)} 
              required 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiry-date">Expiry Date</Label>
            <Input 
              id="expiry-date" 
              type="date"
              value={expiryDate} 
              onChange={(e) => setExpiryDate(e.target.value)} 
              required 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input 
              id="quantity" 
              type="number"
              min="1"
              placeholder="e.g. 100"
              value={quantity} 
              onChange={(e) => setQuantity(e.target.value)} 
              required 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost-price">Cost Price (Optional)</Label>
            <Input 
              id="cost-price" 
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 5.99"
              value={costPrice} 
              onChange={(e) => setCostPrice(e.target.value)} 
            />
          </div>

          <Button type="submit" className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 bg-[#1F7A5A] hover:bg-[#1A6B4E] text-white" disabled={loading}>
            {loading ? "Processing..." : "Receive Batch"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
