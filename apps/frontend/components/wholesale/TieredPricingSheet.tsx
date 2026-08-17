"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";

interface Rule {
  minQuantity: number;
  pricePerUnit: number;
}

export function TieredPricingSheet({ itemId, children }: { itemId: string, children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      const fetchRules = async () => {
        try {
          setLoading(true);
          const res = await fetch(`/api/tiered-pricing/${itemId}`);
          if (res.ok) {
            const data = await res.json();
            setRules(data.rules || []);
          }
        } catch (err) {
          console.error("Failed to fetch rules", err);
        } finally {
          setLoading(false);
        }
      };
      fetchRules();
    }
  }, [open, itemId]);

  const handleAddRule = () => {
    setRules([...rules, { minQuantity: 1, pricePerUnit: 0 }]);
  };

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: keyof Rule, value: string) => {
    const newRules = [...rules];
    newRules[index][field] = Number(value);
    setRules(newRules);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      const res = await fetch(`/api/tiered-pricing/${itemId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      if (!res.ok) throw new Error("Failed to save rules");
      setOpen(false);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent className="sm:max-w-md overflow-y-auto bg-[#FAFAFA]">
        <SheetHeader>
          <SheetTitle>Tiered Pricing Configuration</SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          {error && <div className="text-red-500 text-sm">{error}</div>}
          
          {loading ? (
            <div className="text-gray-500">Loading existing rules...</div>
          ) : (
            <div className="space-y-4">
              {rules.map((rule, index) => (
                <div key={index} className="flex items-end gap-3 border p-3 rounded-md bg-gray-50 dark:bg-gray-900">
                  <div className="space-y-1 flex-1">
                    <Label>Min Qty</Label>
                    <Input 
                      type="number" 
                      min="1" 
                      value={rule.minQuantity} 
                      onChange={(e) => handleChange(index, "minQuantity", e.target.value)} 
                    />
                  </div>
                  <div className="space-y-1 flex-1">
                    <Label>Price / Unit</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      value={rule.pricePerUnit} 
                      onChange={(e) => handleChange(index, "pricePerUnit", e.target.value)} 
                    />
                  </div>
                  <Button variant="destructive" size="icon" onClick={() => handleRemoveRule(index)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}

              {rules.length === 0 && (
                <div className="text-sm text-gray-500 italic">No tiered pricing rules set.</div>
              )}

              <Button type="button" variant="outline" className="w-full flex items-center gap-2" onClick={handleAddRule}>
                <Plus className="w-4 h-4" /> Add Rule
              </Button>
            </div>
          )}

          <Button className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 bg-[#1F7A5A] hover:bg-[#1A6B4E] text-white" onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving..." : "Save Pricing Rules"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
