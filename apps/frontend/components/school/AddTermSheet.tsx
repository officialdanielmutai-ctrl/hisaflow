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
import { Loader2, Plus, Trash } from "lucide-react";

export function AddTermSheet({ onSuccess }: { onSuccess?: () => void }) {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
    dueDate: "",
  });

  const [feeStructures, setFeeStructures] = useState([
    { name: "", amount: "", classId: "" },
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
    if (!membership) return;
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      const payload = {
        ...formData,
        feeStructures: feeStructures.map((f) => ({
          name: f.name,
          amount: parseFloat(f.amount) || 0,
          // Don't send classId if empty — backend expects null or omitted
          ...(f.classId ? { classId: f.classId } : {}),
        })),
      };
      await apiPost("/academic-terms", token, membership.organization.id, payload);
      setOpen(false);
      setFormData({ name: "", startDate: "", endDate: "", dueDate: "" });
      setFeeStructures([{ name: "", amount: "", classId: "" }]);
      onSuccess?.();
      window.location.reload();
    } catch (err: any) {
      setError(err.message || "Failed to add term");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="bg-[#1F7A5A] hover:bg-[#1A6B4E] text-white">Add Term</Button>
      </SheetTrigger>
      <SheetContent className="bg-[#FAFAFA] flex flex-col overflow-hidden sm:max-w-lg">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <SheetTitle className="text-lg font-semibold">Add Academic Term</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {error && (
            <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl">
              {error}
            </div>
          )}
          <form id="add-term-form" onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="t-name">Term Name</Label>
              <Input
                id="t-name"
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

            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Fee Structures</h4>
                <Button type="button" variant="outline" size="sm" onClick={handleAddFee}>
                  <Plus className="h-4 w-4 mr-1" /> Add Fee
                </Button>
              </div>
              <div className="space-y-3">
                {feeStructures.map((fee, index) => (
                  <div
                    key={index}
                    className="flex gap-2 items-start border p-3 rounded-xl bg-white"
                  >
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
          </form>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 bg-[#F5F5F5] flex-shrink-0">
          <Button
            type="submit"
            form="add-term-form"
            className="w-full bg-[#1F7A5A] hover:bg-[#1A6B4E] text-white"
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Term
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
