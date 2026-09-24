# HisaFlow Internal Admin Panel — Master Progress Tracker & Blueprint

> **Reference Documents:**
> - Specification: [hisaflow-admin-panel.md](file:///e:/LEINTUM/Hisa%20Flow/hisaflow-admin-panel.md)
> - Blueprint & Architecture: [implementation_plan.md](file:///C:/Users/user/.gemini/antigravity/brain/c77ed2e5-8ef2-4aa1-90ac-2fdab9dfebe8/implementation_plan.md)
> - Billing Module Reference: [hisaflow-paywall.md](file:///e:/LEINTUM/Hisa%20Flow/hisaflow-paywall.md) (Phase F)

---

## 🏛️ Operating Protocol & Progression Rules

1. **Strict Sequential Gating:** No level/phase may begin until the preceding level is 100% complete, all checklist items are ticked off ([x]), and all verification tests pass.
2. **Every Change Logged:** Every code or schema change must be documented in the **Action & Change Log** below with timestamp, files modified, action summary, and verification outcome.
3. **Foundation Invariant:** Every state-changing operation (account freeze, provider switch, message access, campaign dispatch, role change, work item assignment) MUST write to `AdminAuditLog` before the success response is returned.
4. **Privacy & Compliance Invariant:** Message observability access requires a mandatory, non-bypassable reason prompt logged to `MessageAccessLog` and `AdminAuditLog`. Bulk communications MUST filter out opted-out recipients at the database query level (`WHERE consent.status = 'OPTED_IN'`), never via an optional UI toggle.
5. **Architectural Isolation:** Admin panel code lives in `apps/admin` and backend admin endpoints live in `apps/backend/src/modules/admin/`. Admin code must never leak into customer-facing `apps/frontend`.

---

## 🚦 Phase Status Summary

| Level | Phase Name | Status | Completion % | Gate Ticked Off |
|---|---|---|---|---|
| **Phase 0** | **Foundation: RBAC, Audit Logging & Admin Shell** | 🔄 Ready to Start | 0% | [ ] |
| **Phase 1** | **Account & Organization Management** | ⏳ Blocked by Phase 0 | 0% | [ ] |
| **Phase 2** | **AI Provider Management (LiteLLM)** | ⏳ Blocked by Phase 1 | 0% | [ ] |
| **Phase 3** | **Message & Conversation Observability** | ⏳ Blocked by Phase 2 | 0% | [ ] |
| **Phase 4** | **User & Email Directory** | ⏳ Blocked by Phase 3 | 0% | [ ] |
| **Phase 5** | **Bulk Communications (Resend + Africa's Talking)** | ⏳ Blocked by Phase 4 | 0% | [ ] |
| **Phase 6** | **Marketing Campaigns Manager** | ⏳ Blocked by Phase 5 | 0% | [ ] |
| **Phase 7** | **Internal Work Allocation Queue** | ⏳ Blocked by Phase 6 | 0% | [ ] |
| **Phase 8** | **Central Audit Log Explorer** | ⏳ Blocked by Phase 7 | 0% | [ ] |
| **Phase 9** | **Read-Only Impersonation (View-As)** | ⏳ Blocked by Phase 8 | 0% | [ ] |
| **Phase F** | **Billing Admin (Paystack)** | 🚧 Under Construction | 0% | [ ] (Scoped in paywall.md) |

---

## 📋 Phased Blueprint Checklists & Verification Criteria

---

### Level 0: Foundation — RBAC, Audit Logging & Admin Shell
*Goal: Establish data models, security guards, audit framework, monorepo Next.js app scaffold, and responsive admin shell.*

#### 0.1 Data Layer & Prisma Schema
- [ ] Add `AdminRole` enum: `SUPER_ADMIN`, `SUPPORT_ADMIN`, `BILLING_ADMIN`, `MARKETING_ADMIN`, `OPERATIONS_ADMIN`
- [ ] Add `AdminUser` model with Clerk ID, email, name, role, active status
- [ ] Add `AdminAuditLog` model with adminId, actionType, targetType, targetId, targetLabel, reason, metadata, ipAddress, userAgent
- [ ] Run `npx prisma db push` to sync to PostgreSQL database
- [ ] Run `npx prisma generate` to refresh Prisma Client types

#### 0.2 Backend Admin Core Infrastructure
- [ ] Create `apps/backend/src/modules/admin/admin.module.ts`
- [ ] Implement `AdminAuthGuard` (validates admin Clerk JWT, resolves active AdminUser)
- [ ] Implement `AdminRoleGuard` and `@RequireAdminRoles()` decorator
- [ ] Implement `AdminAuditService.write()` synchronous audit log writer
- [ ] Implement `AdminAuditController` (`GET /admin/audit`) with role checks
- [ ] Implement `DashboardController` with `GET /admin/dashboard/kpis`
- [ ] Register AdminModule in `apps/backend/src/app.module.ts`

#### 0.3 Monorepo `apps/admin` Next.js Application Scaffold
- [ ] Scaffold Next.js 15 App Router app in `apps/admin`
- [ ] Configure `apps/admin/package.json` with workspace dependencies (types, lucide-react, tailwindcss, shadcn, clerk)
- [ ] Set up Tailwind CSS, CSS variables, and layout styles
- [ ] Verify `pnpm install` and workspace recognition

#### 0.4 Admin Shell Layout & Navigation
- [ ] Implement persistent sidebar with module grouping (Core, Accounts, Intelligence, Support, Comms, Operations, System)
- [ ] Implement top bar with global search input, admin identity card, role pill, and sign-out
- [ ] Implement role-aware sidebar navigation (items hidden/disabled if role unauthorized)
- [ ] Create Dashboard Home page with KPI cards and recent audit activity feed
- [ ] Create Sign-in page (Clerk email/password + Google, restricted to admin domain)
- [ ] Create Billing placeholder page ("Under Construction — see hisaflow-paywall.md Phase F")

#### Level 0 Verification Gate (Done When):
- [ ] `AdminAuditService.write()` persists audit events to DB with actor, IP, metadata
- [ ] Non-admin JWT or inactive admin user is rejected with 401
- [ ] Admin with insufficient role receives 403 Forbidden from guarded endpoint
- [ ] Admin shell renders sidebar, top bar, and KPI dashboard with zero console errors
- [ ] Backend & Admin TypeScript checks pass with 0 errors (`tsc --noEmit`)

---

### Level 1: Account & Organization Management
*Goal: Provide full visibility into customer accounts, live Clerk status, and audit-logged freeze/unfreeze actions.*

#### 1.1 Backend Account Services & Endpoints
- [ ] Implement `GET /admin/accounts` with search (name, email, phone), filters (businessType, status), and pagination
- [ ] Implement `GET /admin/accounts/:orgId` returning org metadata, subscription status, and live Clerk user list
- [ ] Implement `POST /admin/accounts/:orgId/freeze` using Clerk Backend API `banUser()` for all members; mandatory reason; writes to `AdminAuditLog`
- [ ] Implement `POST /admin/accounts/:orgId/unfreeze` using Clerk `unbanUser()`; mandatory reason; writes to `AdminAuditLog`
- [ ] Implement `GET /admin/accounts/:orgId/history` returning org-specific audit trail

#### 1.2 Frontend Account Views
- [ ] Build Accounts List View using TanStack Table (search bar, status filter, type filter, pagination)
- [ ] Build Account Detail View (Header banner, Status pill, Org info card, Subscription summary)
- [ ] Build Live Users Tab pulling current Clerk status (Active, Banned, Last active)
- [ ] Build Freeze Account Modal with mandatory reason selection + impact explanation
- [ ] Build Unfreeze Account Modal with reason prompt
- [ ] Build Org Audit History Tab displaying prior admin interventions

#### Level 1 Verification Gate (Done When):
- [ ] Admin can search any account by name or phone and view live data
- [ ] Freezing an account immediately bans users in Clerk and logs to `AdminAuditLog` within the same transaction
- [ ] Unfreezing reverses ban and logs to audit trail
- [ ] Account history tab displays complete timeline of freeze/unfreeze actions

---

### Level 2: AI Provider Management (LiteLLM)
*Goal: Allow non-technical admins to switch, reorder, add, and monitor AI providers without touching code or config files.*

#### 2.1 Backend LiteLLM Proxy Integration
- [ ] Configure backend connection to LiteLLM Management API (`LITELLM_PROXY_URL`, `LITELLM_MASTER_KEY`)
- [ ] Implement `GET /admin/providers` wrapping LiteLLM `GET /model/info`
- [ ] Implement `POST /admin/providers` wrapping LiteLLM `POST /model/new` (write-only API key handling)
- [ ] Implement `PATCH /admin/providers/:id` wrapping LiteLLM `POST /model/update`
- [ ] Implement `DELETE /admin/providers/:id` wrapping LiteLLM `POST /model/delete`
- [ ] Implement `POST /admin/providers/:id/set-primary` adjusting fallback priority sequence
- [ ] Implement `GET /admin/providers/health` performing ping checks on configured model endpoints
- [ ] Ensure all provider mutations write before/after config diffs to `AdminAuditLog`

#### 2.2 Frontend Provider Control Center
- [ ] Build Provider Table with drag-and-drop priority reordering
- [ ] Display real-time status indicators (Active, Degraded, Offline) and latency badges
- [ ] Build Add Provider Modal (Provider dropdown, Model identifier, API key input [masked], RPM limit, Max tokens)
- [ ] Build Edit Provider Modal with key rotation option
- [ ] Build Delete Provider Confirmation Dialog
- [ ] Render 24-hour latency and health telemetry chart

#### Level 2 Verification Gate (Done When):
- [ ] Adding a provider via the panel registers it in LiteLLM without server restart
- [ ] Reordering priorities alters the fallback routing for subsequent AI requests
- [ ] Raw API keys are never exposed in GET API responses
- [ ] Every change produces a verifiable audit record with before/after diff

---

### Level 3: Message & Conversation Observability
*Goal: Give support admins verified visibility into conversation histories protected by mandatory reason gating and audit trails.*

#### 3.1 Data Layer & Backend Service
- [ ] Add `MessageAccessLog` model to Prisma schema (adminId, adminName, orgId, orgName, accessReason, reasonNote, timestamp)
- [ ] Implement `POST /admin/messages/access` requiring valid reason from fixed taxonomy:
  - `Support ticket`, `Abuse investigation`, `Billing dispute`, `Account verification`, `Compliance review`, `Other (specify)`
- [ ] Return time-limited access session token (30-minute validity)
- [ ] Implement `GET /admin/messages/:orgId/conversations` (gated by access token)
- [ ] Implement `GET /admin/messages/:orgId/conversations/:convId` returning full message thread
- [ ] Implement `GET /admin/messages/access-logs` (Super Admin view of recently accessed accounts)

#### 3.2 Frontend Conversation Viewer & Reason Prompt
- [ ] Build Reason-Prompt Modal triggered whenever an admin navigates to an org's messages
- [ ] Prevent rendering of conversation content until reason is submitted and logged
- [ ] Build Conversation Thread Viewer with persistent banner: "Viewing as [Role] [Name] — Reason: [Reason] — Access Logged"
- [ ] Render read-only message feed with timestamps, sender tags (User / AI / System), and attachments
- [ ] Build "Recently Viewed By" Audit Table for Super Admins

#### Level 3 Verification Gate (Done When):
- [ ] Direct URL navigation to messages without an access token is blocked
- [ ] Reason prompt successfully writes to `MessageAccessLog` and `AdminAuditLog`
- [ ] Access logs table shows exactly who viewed what account, when, and for what reason

---

### Level 4: User & Email Directory
*Goal: Maintain a live, searchable directory of all customers sourced directly from Clerk with consent tracking.*

#### 4.1 Backend Directory Service
- [ ] Implement `GET /admin/directory/users` proxying live Clerk Users API with query search & pagination
- [ ] Implement `GET /admin/directory/users/:clerkId` with org membership and consent status
- [ ] Implement `PATCH /admin/directory/users/:clerkId/consent` updating opt-in/opt-out status with audit log

#### 4.2 Frontend Directory UI
- [ ] Build User Directory Table (Name, Email, Phone, Primary Org, Consent Badges, Last Active)
- [ ] Build Live Search Bar (instant search against Clerk without stale local cache)
- [ ] Build User Details Drawer showing memberships, auth history, and consent controls
- [ ] Implement Export to CSV function

#### Level 4 Verification Gate (Done When):
- [ ] User profile edits in Clerk appear immediately in the admin directory
- [ ] Consent status can be toggled and writes to `CommunicationConsent` and `AdminAuditLog`
- [ ] CSV export correctly reflects filtered user lists

---

### Level 5: Bulk Communications (Email & SMS)
*Goal: Provide a multi-channel bulk communication engine with strict, non-negotiable opt-out enforcement.*

#### 5.1 Data Layer & Backend Comms Engine
- [ ] Add `CommunicationConsent`, `CampaignStatus`, `CampaignDelivery` models to Prisma
- [ ] Integrate Resend SDK for transactional/broadcast emails
- [ ] Integrate Africa's Talking SDK for high-deliverability SMS across East Africa
- [ ] Implement `POST /admin/comms/preview`: calculate recipients, displaying total eligible vs. excluded (opted-out)
- [ ] Implement `POST /admin/comms/send`: enqueue BullMQ job with structural query `WHERE consent.status = 'OPTED_IN'`
- [ ] Implement `GET /admin/comms/history` returning delivery batches and status rates

#### 5.2 Frontend Bulk Dispatcher
- [ ] Build Bulk Send Interface with Channel toggle (Email / SMS)
- [ ] Build Audience Selector (All active, Segment by business type / plan, CSV upload)
- [ ] Build Content Editor (Subject line, Rich-text email template / SMS character counter)
- [ ] Build Recipient Calculator Card (showing exact opted-in count and excluded count)
- [ ] Build Live Dispatch Progress Bar (Sent, Delivered, Failed)

#### Level 5 Verification Gate (Done When):
- [ ] Opted-out test user is verified as 100% excluded from send queries
- [ ] Bulk email delivers via Resend and bulk SMS delivers via Africa's Talking
- [ ] Delivery status is recorded per recipient in `CampaignDelivery`

---

### Level 6: Marketing Campaigns Manager
*Goal: Enable marketing admins to build, schedule, and track performance of targeted multi-channel campaigns.*

#### 6.1 Backend Campaign Service
- [ ] Implement Campaign CRUD (Create draft, Update, List, Detail, Cancel)
- [ ] Implement Audience Segmentation Engine (filter by businessType, subscription tier, country, activity)
- [ ] Implement Campaign Scheduler worker using BullMQ delayed jobs
- [ ] Implement Webhook receivers for open/click tracking from Resend

#### 6.2 Frontend Campaign Hub
- [ ] Build Campaign List View with Status pills, scheduled dates, and reach numbers
- [ ] Build 3-Step Campaign Wizard:
  1. Audience Segmentation (live reach estimator)
  2. Content & Template Library (pre-built updates, announcements)
  3. Scheduling & Review
- [ ] Build Campaign Analytics Detail View (Delivered %, Open Rate %, Click Rate %, Recipient delivery breakdown)

#### Level 6 Verification Gate (Done When):
- [ ] Campaign can be scheduled for future execution and fires automatically
- [ ] Segment filter accurately selects intended audience
- [ ] Open and click metrics update accurately upon webhook arrival

---

### Level 7: Internal Work Allocation Queue
*Goal: Track internal operational tasks, escalations, and support cases with team assignments and lifecycle management.*

#### 7.1 Backend Work Queue Service
- [ ] Add `AdminWorkItem` model to Prisma schema
- [ ] Implement CRUD endpoints (`GET /admin/work-queue`, `POST`, `GET /:id`, `PATCH /:id`)
- [ ] Support priority levels (Low, Medium, High, Urgent) and statuses (Open, In Progress, Resolved, Closed)
- [ ] Audit-log assignment changes and status transitions

#### 7.2 Frontend Work Queue Dashboard
- [ ] Build Work Queue Board / Filterable Table (filter by status, assignee, priority, org)
- [ ] Build Create Work Item Modal (with org auto-complete search)
- [ ] Build Work Item Detail Drawer (Assignment dropdown, Status stepper, internal notes timeline)
- [ ] Require resolution note when transitioning to Resolved

#### Level 7 Verification Gate (Done When):
- [ ] Admin can create task, link customer org, and assign to colleague
- [ ] Reassignment and resolution generate audit records
- [ ] Open urgent tasks surface immediately on Dashboard home

---

### Level 8: Central Audit Log Explorer
*Goal: Provide super admins with a tamper-evident, filterable investigation log covering all panel actions.*

#### 8.1 Backend Audit Service
- [ ] Implement `GET /admin/audit` with multidimensional filtering (adminId, actionType, targetType, date range)
- [ ] Implement `GET /admin/audit/export` generating CSV report

#### 8.2 Frontend Audit Explorer
- [ ] Build High-Performance Audit Table with timestamp, admin, action, target, reason
- [ ] Build JSON Metadata Inspector Drawer for deep-dive investigation
- [ ] Add Quick Filters ("Freezes today", "Message views this week", "Provider changes")
- [ ] Add CSV Export button

#### Level 8 Verification Gate (Done When):
- [ ] All previous actions (freezes, views, switches, campaigns) appear in chronological order
- [ ] Filtering by admin or date range returns instantaneous filtered results
- [ ] CSV export matches table filters

---

### Level 9: Read-Only Impersonation (View-As)
*Goal: Allow support admins to troubleshoot customer issues by viewing accounts exactly as the customer sees them, in read-only mode.*

#### 9.1 Backend Token Generator
- [ ] Implement `POST /admin/accounts/:orgId/impersonate` (Super Admin only; reason required)
- [ ] Generate short-lived (15-min) scoped JWT carrying `impersonatedByAdminId` and `readOnly: true`
- [ ] Update customer API guards to reject write mutations when `readOnly: true` is present

#### 9.2 Frontend View-As Integration
- [ ] Add "View As" action button in Account Detail
- [ ] Customer frontend detects impersonation token and renders persistent bright amber banner:
  - "ADMIN VIEW-AS MODE (READ-ONLY) — Acting as [Org Name] — [Exit View-As]"
- [ ] Disable all form submission / mutation buttons in view-as mode

#### Level 9 Verification Gate (Done When):
- [ ] Impersonation session logs reason to `AdminAuditLog`
- [ ] Read-only view renders customer interface accurately
- [ ] Any attempt to execute a mutation while impersonating returns 403 Forbidden

---

### Level F: Billing Admin (Paystack)
*Status: Scheduled for subsequent phase alongside `hisaflow-paywall.md` Phase F.*
- [ ] Renders "Under Construction" view with link to paywall roadmap
- [ ] Will incorporate subscription list, manual retry, grace period extension, and refund initiation

---

## 📜 Action & Change Log

| Entry # | Date & Time | Level / Phase | Action Summary | Files Touched | Verification Outcome |
|---|---|---|---|---|---|
| #001 | 2026-09-24 18:15 | Protocol | Created Master Progress Tracker & Blueprint with strict level gating | `hisaflow-admin-panel-tracker.md` | Protocol established |

