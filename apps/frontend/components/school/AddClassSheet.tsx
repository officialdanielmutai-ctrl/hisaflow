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

export function AddClassSheet({ onSuccess }: { onSuccess?: () => void }) {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({ name: "", stream: "", notes: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!membership) return;
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      await apiPost("/school-classes", token, membership.organization.id, formData);
      setOpen(false);
      setFormData({ name: "", stream: "", notes: "" });
      onSuccess?.();
      window.location.reload();
    } catch (err: any) {
      setError(err.message || "Failed to add class");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="bg-[#1F7A5A] hover:bg-[#1A6B4E] text-white">Add Class</Button>
      </SheetTrigger>
      <SheetContent className="bg-[#FAFAFA] flex flex-col overflow-hidden">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <SheetTitle className="text-lg font-semibold">Add New Class</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {error && (
            <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl">
              {error}
            </div>
          )}
          <form id="add-class-form" onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Class Name</Label>
              <Input
                id="name"
                required
                placeholder="e.g. Form 1"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stream">Stream</Label>
              <Input
                id="stream"
                required
                placeholder="e.g. East"
                value={formData.stream}
                onChange={(e) => setFormData({ ...formData, stream: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                placeholder="Optional notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </form>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 bg-[#F5F5F5] flex-shrink-0">
          <Button
            type="submit"
            form="add-class-form"
            className="w-full bg-[#1F7A5A] hover:bg-[#1A6B4E] text-white"
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Class
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
