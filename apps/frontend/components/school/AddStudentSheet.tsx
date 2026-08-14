"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export function AddStudentSheet() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<{ id: string; name: string; stream: string }[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    admissionNumber: "",
    classId: "",
    parentName: "",
    parentPhone: "",
  });

  useEffect(() => {
    if (open && classes.length === 0) {
      fetch("/api/school-classes")
        .then((res) => res.json())
        .then((data) => setClasses(data || []))
        .catch(console.error);
    }
  }, [open, classes.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setOpen(false);
        setFormData({ name: "", admissionNumber: "", classId: "", parentName: "", parentPhone: "" });
        window.location.reload();
      } else {
        console.error("Failed to add student");
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
        <Button>Add Student</Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add New Student</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
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
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
            <h4 className="text-sm font-medium">Parent/Guardian Details</h4>
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
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Student
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
