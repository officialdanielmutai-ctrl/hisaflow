export type AdminRole =
  | 'SUPER_ADMIN'
  | 'SUPPORT_ADMIN'
  | 'BILLING_ADMIN'
  | 'MARKETING_ADMIN'
  | 'OPERATIONS_ADMIN';

export interface AdminUser {
  id: string;
  clerkId: string;
  email: string;
  name: string;
  role: AdminRole;
  isActive: boolean;
  createdAt: string;
}

export interface AdminAuditLogEntry {
  id: string;
  adminId: string;
  actionType: string;
  targetType: string;
  targetId?: string;
  targetLabel?: string;
  reason?: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  admin: {
    id: string;
    name: string;
    email: string;
    role: AdminRole;
  };
}

export interface DashboardKpis {
  activeOrganizations: number;
  newSignupsThisWeek: number;
  totalUsers: number;
  totalSubscribers: number;
  activeRouters: number;
  openAlerts: number;
  aiProviderHealth: string;
}

export interface DashboardResponse {
  kpis: DashboardKpis;
  recentActivity: AdminAuditLogEntry[];
}
