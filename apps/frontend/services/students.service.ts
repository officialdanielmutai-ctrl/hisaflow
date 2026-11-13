import { apiGet } from '@/lib/api-client';

export interface StudentFeeInvoice {
  id: string;
  studentId: string;
  termId: string;
  status: 'DRAFT' | 'ISSUED' | 'PARTIAL' | 'PAID' | 'VOIDED';
  totalExpected: number;
  adjustmentsTotal: number;
  amountPaid: number;
  issuedAt?: string | null;
  dueDate?: string | null;
  term?: { id: string; name: string };
}

export interface StudentDetail {
  id: string;
  name: string;
  admissionNumber?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  class?: { id: string; name: string; stream?: string | null } | null;
  feeInvoices: StudentFeeInvoice[];
}

export function getStudent(
  studentId: string,
  token: string,
  organizationId: string,
): Promise<StudentDetail> {
  return apiGet<StudentDetail>(
    `/students/${studentId}`,
    token,
    organizationId,
  );
}
