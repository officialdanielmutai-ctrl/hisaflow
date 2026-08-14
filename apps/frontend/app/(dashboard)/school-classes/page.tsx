"use client";

import { useEffect, useState } from "react";
import { AddClassSheet } from "@/components/school/AddClassSheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SchoolClass {
  id: string;
  name: string;
  stream: string;
  notes?: string;
  studentCount?: number;
}

export default function SchoolClassesPage() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClasses() {
      try {
        const res = await fetch("/api/school-classes");
        if (res.ok) {
          const data = await res.json();
          setClasses(data);
        }
      } catch (error) {
        console.error("Failed to fetch classes", error);
      } finally {
        setLoading(false);
      }
    }
    fetchClasses();
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">School Classes</h1>
          <p className="text-muted-foreground">Manage your classes and streams.</p>
        </div>
        <AddClassSheet />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center p-12 border rounded-xl border-dashed">
          <p className="text-muted-foreground">No classes found. Add one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <Card key={cls.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">{cls.name} {cls.stream}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground mb-2">
                  {cls.studentCount || 0} Students
                </div>
                {cls.notes && (
                  <p className="text-sm border-t pt-2 mt-2">{cls.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
