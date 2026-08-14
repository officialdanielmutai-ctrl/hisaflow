"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RecordPaymentSheet } from "@/components/school/RecordPaymentSheet";

export default function StudentProfilePage() {
  const params = useParams();
  const studentId = params?.id;
  
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    
    async function fetchStudent() {
      try {
        const res = await fetch(`/api/students/${studentId}`);
        if (res.ok) {
          const data = await res.json();
          setStudent(data);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    fetchStudent();
  }, [studentId]);

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!student) {
    return <div className="p-6 text-center">Student not found</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Profile Header */}
      <Card>
        <CardContent className="p-6 flex flex-col md:flex-row items-center md:items-start gap-6">
          <Avatar className="h-24 w-24">
            <AvatarFallback className="text-3xl">
              {student.name?.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-3xl font-bold">{student.name}</h1>
            <div className="text-muted-foreground mt-2 space-x-4">
              <span>Adm: {student.admissionNumber}</span>
              <span>•</span>
              <span>Class: {student.className || "Unassigned"}</span>
            </div>
            {student.parentName && (
              <div className="text-sm mt-4 bg-muted inline-block px-3 py-1 rounded-full">
                Parent: {student.parentName} ({student.parentPhone})
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fee Invoices */}
      <h2 className="text-2xl font-bold mt-8 mb-4">Fee Invoices</h2>
      {student.feeInvoices && student.feeInvoices.length > 0 ? (
        <div className="space-y-4">
          {student.feeInvoices.map((invoice: any) => {
            const balance = invoice.totalExpected - invoice.amountPaid;
            const isPaid = balance <= 0;
            return (
              <Card key={invoice.id} className={isPaid ? "border-green-200" : "border-orange-200"}>
                <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold">{invoice.termName}</div>
                    <div className="text-sm text-muted-foreground">Due: {new Date(invoice.dueDate).toLocaleDateString()}</div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Expected</div>
                      <div className="font-medium">KES {invoice.totalExpected.toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Paid</div>
                      <div className="font-medium text-green-600">KES {invoice.amountPaid.toLocaleString()}</div>
                    </div>
                    <div className="text-right min-w-[80px]">
                      <div className="text-sm text-muted-foreground">Balance</div>
                      <div className="font-bold text-destructive">KES {balance.toLocaleString()}</div>
                    </div>
                    
                    <div>
                      {isPaid ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Cleared
                        </Badge>
                      ) : (
                        <RecordPaymentSheet 
                          invoiceId={invoice.id} 
                          totalExpected={invoice.totalExpected} 
                          amountPaid={invoice.amountPaid} 
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No fee invoices found for this student.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
