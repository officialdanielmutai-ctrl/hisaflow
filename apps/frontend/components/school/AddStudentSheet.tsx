"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMyOrganization } from "@/hooks/useMyOrganization";
import { apiGet, apiPost } from "@/lib/api-client";
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

export function AddStudentSheet({ onSuccess }: { onSuccess?: () => void }) {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [classes, setClasses] = useState<{ id: string; name: string; stream: string }[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    admissionNumber: "",
    classId: "",
    parentName: "",
    parentPhone: "",
  });

  useEffect(() => {
    if (open && classes.length === 0 && membership) {
      getToken().then((token) => {
        if (!token) return;
        apiGet<{ id: string; name: string; stream: string }[]>(
          "/school-classes",
          token,
          membership.organization.id
        )
          .then((data) => setClasses(data || []))
          .catch(console.error);
      });
    }
  }, [open, classes.length, membership, getToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!membership) return;
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      await apiPost("/students", token, membership.organization.id, formData);
      setOpen(false);
      setFormData({ name: "", admissionNumber: "", classId: "", parentName: "", parentPhone: "" });
      onSuccess?.();
      window.location.reload();
    } catch (err: any) {
      setError(err.message || "Failed to add student");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="bg-[#1F7A5A] hover:bg-[#1A6B4E] text-white">Add Student</Button>
      </SheetTrigger>
      <SheetContent className="bg-[#FAFAFA] flex flex-col overflow-hidden">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <SheetTitle className="text-lg font-semibold">Add New Student</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {error && (
            <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl">
              {error}
            </div>
          )}
          <form id="add-student-form" onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="s-name">Full Name</Label>
              <Input
                id="s-name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adm">Admission Number</Label>
              <Input
                id="adm"
                required
                value={formData.admissionNumber}
                onChange={(e) => setFormData({ ...formData, admissionNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class">Class</Label>
              <select
                id="class"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.classId}
                onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
              >
                <option value="">Select a class...</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} {cls.stream}
                  </option>
                ))}
              </select>
            </div>
            <div className="pt-4 border-t space-y-4">
              <h4 className="text-sm font-medium">Parent / Guardian Details</h4>
              <div className="space-y-2">
                <Label htmlFor="pName">Parent Name</Label>
                <Input
                  id="pName"
                  value={formData.parentName}
                  onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pPhone">Parent Phone</Label>
                <Input
                  id="pPhone"
                  value={formData.parentPhone}
                  onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                />
              </div>
            </div>
          </form>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 bg-[#F5F5F5] flex-shrink-0">
          <Button
            type="submit"
            form="add-student-form"
            className="w-full bg-[#1F7A5A] hover:bg-[#1A6B4E] text-white"
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Student
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
