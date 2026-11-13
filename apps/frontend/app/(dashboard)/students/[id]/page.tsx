'use client';

import { useAuth } from '@clerk/nextjs';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { apiPost } from '@/lib/api-client';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { getStudent, type StudentFeeInvoice } from '@/services/students.service';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RecordPaymentSheet } from '@/components/school/RecordPaymentSheet';

export default function StudentProfilePage() {
  const params = useParams();
  const studentId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const orgId = membership?.organization.id;

  const { data: student, isLoading, mutate } = useSWR(
    studentId && orgId ? ['student', orgId, studentId] : null,
    async () => {
      const token = await getToken();
      if (!token || !orgId || !studentId) throw new Error('Not authenticated');
      return getStudent(studentId, token, orgId);
    },
  );

  const issueInvoice = async (invoiceId: string) => {
    if (!orgId) return;
    const token = await getToken();
    if (!token) return;
    await apiPost(`/school-fees/invoice/${invoiceId}/issue`, token, orgId, {});
    await mutate();
  };

  if (isLoading) {
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

  const guardianLabel = student.guardianName
    ? `${student.guardianName}${student.guardianPhone ? ` (${student.guardianPhone})` : ''}`
    : null;

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
              <span>Adm: {student.admissionNumber || '—'}</span>
              <span>•</span>
              <span>Class: {student.class?.name || 'Unassigned'}</span>
            </div>
            {guardianLabel && (
              <div className="text-sm mt-4 bg-muted inline-block px-3 py-1 rounded-full">
                Guardian: {guardianLabel}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fee Invoices */}
      <h2 className="text-2xl font-bold mt-8 mb-4">Fee Invoices</h2>
      {student.feeInvoices && student.feeInvoices.length > 0 ? (
        <div className="space-y-4">
          {student.feeInvoices.map((invoice: StudentFeeInvoice) => {
            const expected =
              Number(invoice.totalExpected) - Number(invoice.adjustmentsTotal ?? 0);
            const paid = Number(invoice.amountPaid);
            const balance = expected - paid;
            const isPaid = balance <= 0;
            const isDraft = invoice.status === 'DRAFT';

            return (
              <Card
                key={invoice.id}
                className={isPaid ? 'border-green-200' : 'border-orange-200'}
              >
                <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold">
                      {invoice.term?.name ?? 'Fee invoice'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {invoice.dueDate
                        ? `Due: ${new Date(invoice.dueDate).toLocaleDateString()}`
                        : 'No due date'}
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Expected</div>
                      <div className="font-medium">
                        KES {expected.toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Paid</div>
                      <div className="font-medium text-green-600">
                        KES {paid.toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right min-w-[80px]">
                      <div className="text-sm text-muted-foreground">Balance</div>
                      <div className="font-bold text-destructive">
                        KES {Math.max(balance, 0).toLocaleString()}
                      </div>
                    </div>

                    <div>
                      {isPaid ? (
                        <Badge
                          variant="outline"
                          className="bg-green-50 text-green-700 border-green-200"
                        >
                          Cleared
                        </Badge>
                      ) : isDraft ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => issueInvoice(invoice.id)}
                        >
                          Issue invoice
                        </Button>
                      ) : (
                        <RecordPaymentSheet
                          invoiceId={invoice.id}
                          totalExpected={expected}
                          amountPaid={paid}
                          onSuccess={() => mutate()}
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
