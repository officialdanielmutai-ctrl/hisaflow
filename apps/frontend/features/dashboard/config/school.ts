import { Banknote, BookOpen, CheckCircle2, Users } from 'lucide-react';
import type { SchoolDashboardData } from '@/services/analytics.service';
import type { StatCardConfig } from '@/components/system/StatCard';
import { formatKpiNumber } from '@/lib/kpi-format';

/**
 * School dashboard arrangement (overhaul Section 2.5).
 *
 * Only the cards, their order and their width live here; the shared
 * `StatCard` owns the layout, sizing, formatting and states.
 */
export const SCHOOL_KPI_ROWS: StatCardConfig<SchoolDashboardData>[][] = [
  [
    {
      id: 'total-students',
      label: 'Total Students',
      icon: Users,
      iconTone: 'emerald',
      cardTone: 'hero',
      href: '/students',
      build: (data) => ({
        value: `${data.totalStudents}`,
        footnote: 'Active enrollment',
        delta: {
          value: '+8%',
          period: 'vs last term',
          direction: 'up',
          tone: 'success',
        },
        sparklineData: [180, 195, 210, 205, 220, 235, 248],
      }),
    },
    {
      id: 'active-classes',
      label: 'Active Classes',
      icon: BookOpen,
      iconTone: 'emerald',
      cardTone: 'neutral',
      href: '/school-classes',
      build: (data) => ({
        value: `${data.totalClasses}`,
        footnote: 'Streams included',
        progress: {
          value: Math.min((data.totalClasses / 12) * 100, 100),
          max: 100,
          label: 'School Capacity',
          targetLabel: `${data.totalClasses} Streams`,
        },
      }),
    },
  ],
  [
    {
      id: 'fees-collected',
      label: 'Fees Collected',
      icon: CheckCircle2,
      iconTone: 'emerald',
      cardTone: 'neutral',
      href: '/school-fees',
      build: (data) => {
        const collected = formatKpiNumber(data.fees.totalCollected);
        return {
          value: `KES ${collected.display}`,
          fullValue: `KES ${collected.full}`,
          footnote: `${data.fees.paidCount} of ${data.fees.totalInvoices} invoices paid`,
          footnoteTone: 'success',
          gauge: {
            value: data.fees.collectionRate,
            max: 100,
            label: 'Collection Rate',
          },
        };
      },
    },
    {
      id: 'outstanding',
      label: 'Outstanding',
      icon: Banknote,
      iconTone: 'rose',
      cardTone: 'neutral',
      href: '/school-fees',
      build: (data) => {
        const outstanding = formatKpiNumber(data.fees.outstanding);
        return {
          value: `KES ${outstanding.display}`,
          fullValue: `KES ${outstanding.full}`,
          footnote: `${100 - data.fees.collectionRate}% unpaid`,
          footnoteTone: data.fees.outstanding > 0 ? 'critical' : 'success',
          progress: {
            value: data.fees.collectionRate,
            max: 100,
            label: 'Term Collection',
            targetLabel: `${100 - data.fees.collectionRate}% Unpaid`,
          },
        };
      },
    },
  ],
];
