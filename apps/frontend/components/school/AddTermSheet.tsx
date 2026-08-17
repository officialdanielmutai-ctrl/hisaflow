"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash } from "lucide-react";

export function AddTermSheet() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
    dueDate: "",
  });
  
  const [feeStructures, setFeeStructures] = useState([
    { name: "", amount: "", classId: "" }
  ]);

  const handleAddFee = () => {
    setFeeStructures([...feeStructures, { name: "", amount: "", classId: "" }]);
  };

  const handleRemoveFee = (index: number) => {
    setFeeStructures(feeStructures.filter((_, i) => i !== index));
  };

  const handleFeeChange = (index: number, field: string, value: string) => {
    const newFees = [...feeStructures];
    newFees[index] = { ...newFees[index], [field]: value };
    setFeeStructures(newFees);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        feeStructures: feeStructures.map(f => ({
          ...f,
          amount: parseFloat(f.amount) || 0
        }))
      };
      const res = await fetch("/api/academic-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setOpen(false);
        window.location.reload();
      } else {
        console.error("Failed to add term");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="bg-[#1F7A5A] hover:bg-[#1A6B4E] text-white">Add Term</Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-lg bg-[#FAFAFA]">
        <SheetHeader>
          <SheetTitle>Add Academic Term</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Term Name</Label>
              <Input
                id="name"
                required
                placeholder="e.g. Term 1 2026"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  required
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Payment Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                required
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium">Fee Structures</h4>
              <Button type="button" variant="outline" size="sm" onClick={handleAddFee}>
                <Plus className="h-4 w-4 mr-1" /> Add Fee
              </Button>
            </div>
            <div className="space-y-4">
              {feeStructures.map((fee, index) => (
                <div key={index} className="flex gap-2 items-start border p-3 rounded-md bg-accent/20">
                  <div className="grid grid-cols-2 gap-2 flex-1">
                    <Input
                      placeholder="Fee Name (e.g. Tuition)"
                      value={fee.name}
                      onChange={(e) => handleFeeChange(index, "name", e.target.value)}
                      required
                      className="h-8 text-sm"
                    />
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={fee.amount}
                      onChange={(e) => handleFeeChange(index, "amount", e.target.value)}
                      required
                      className="h-8 text-sm"
                    />
                    <Input
                      placeholder="Class ID (Optional)"
                      value={fee.classId}
                      onChange={(e) => handleFeeChange(index, "classId", e.target.value)}
                      className="h-8 text-sm col-span-2"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleRemoveFee(index)}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full bg-[#1F7A5A] hover:bg-[#1A6B4E] text-white" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Term
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
