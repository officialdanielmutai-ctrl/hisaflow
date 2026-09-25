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

export interface OrganizationListItem {
  id: string;
  name: string;
  businessType: string;
  currency: string;
  country: string;
  phone?: string;
  inviteCode?: string;
  createdAt: string;
  updatedAt: string;
  status: 'ACTIVE' | 'FROZEN';
  _count: {
    users: number;
    products: number;
    subscribers: number;
    alerts: number;
  };
}

export interface OrgUserItem {
  id: string;
  role: string;
  user: {
    id: string;
    clerkId: string;
    name?: string;
    email?: string;
    phone?: string;
    banned: boolean;
    imageUrl?: string;
    lastActiveAt?: string;
  };
}

export interface AccountDetailResponse {
  organization: {
    id: string;
    name: string;
    businessType: string;
    currency: string;
    country: string;
    phone?: string;
    inviteCode?: string;
    createdAt: string;
    updatedAt: string;
    status: 'ACTIVE' | 'FROZEN';
    counts: {
      products: number;
      transactions: number;
      subscribers: number;
      routers: number;
      alerts: number;
    };
  };
  users: OrgUserItem[];
  latestAction?: AdminAuditLogEntry;
}

export interface ProviderItem {
  id: string;
  modelName: string;
  provider: string;
  litellmModelId: string;
  rpm?: number;
  maxTokens?: number;
  priority: number;
  status: 'ACTIVE' | 'DEGRADED' | 'OFFLINE';
  avgLatencyMs: number;
  lastTestedAt?: string;
  maskedKey: string;
}

export interface ProvidersResponse {
  providers: ProviderItem[];
  connected: boolean;
  proxyUrl: string;
}

export interface ProviderHealthResponse {
  status: 'HEALTHY' | 'STANDBY';
  proxyUrl: string;
  roundtripLatencyMs: number;
  totalModelsConfigured: number;
  fallbackChain: Array<{ priority: number; model: string; provider: string }>;
  error?: string | null;
}

export interface MessageAccessLogEntry {
  id: string;
  adminId: string;
  adminName: string;
  orgId: string;
  orgName: string;
  accessReason: string;
  reasonNote?: string;
  accessedAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  channel: string;
  lastMessageSnippet: string;
  lastMessageAt: string;
  messageCount: number;
}

export interface MessageItem {
  id: string;
  senderType: 'USER' | 'AI_SYSTEM' | 'NOTIFICATION_DISPATCH' | 'STAFF';
  senderName: string;
  channel: 'WHATSAPP' | 'SMS' | 'AI_INGESTION' | 'SYSTEM_ALERT';
  content: string;
  timestamp: string;
  metadata?: any;
}

export interface DirectoryUser {
  clerkId: string;
  name: string;
  email?: string;
  phone?: string;
  imageUrl?: string;
  banned: boolean;
  lastActiveAt?: string;
  createdAt: string;
  emailStatus: 'OPTED_IN' | 'OPTED_OUT';
  smsStatus: 'OPTED_IN' | 'OPTED_OUT';
  primaryOrg?: {
    id: string;
    name: string;
    businessType: string;
    role: string;
  };
}
export interface BulkPreviewResult {
  channel: 'EMAIL' | 'SMS';
  recipientCount: number;
  excludedCount: number;
  totalAudience: number;
  sampleRecipients: Array<{ name: string; email?: string; phone?: string; org?: string }>;
  filterSummary: string;
  estimatedCost?: string;
}

export interface BulkSendLogEntry {
  id: string;
  adminId: string;
  adminName: string;
  channel: 'EMAIL' | 'SMS';
  subject?: string;
  body: string;
  recipientCount: number;
  successCount: number;
  failureCount: number;
  status: 'DRAFT' | 'SENDING' | 'SENT' | 'PARTIAL_FAILURE' | 'FAILED';
  filterSummary?: string;
  sentAt?: string;
  createdAt: string;
  _count?: {
    deliveries: number;
  };
}

export interface BulkSendHistoryResponse {
  logs: BulkSendLogEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface MarketingCampaign {
  id: string;
  name: string;
  channel: 'EMAIL' | 'SMS';
  status: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';
  subject?: string;
  body: string;
  templateName?: string;
  segmentCriteria: {
    businessTypes?: string[];
    orgSearch?: string;
    activityDays?: number;
  };
  scheduledAt?: string;
  executedAt?: string;
  recipientCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  failedCount: number;
  createdByAdminId: string;
  createdByAdminName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignListResponse {
  campaigns: MarketingCampaign[];
  total: number;
  page: number;
  limit: number;
}


