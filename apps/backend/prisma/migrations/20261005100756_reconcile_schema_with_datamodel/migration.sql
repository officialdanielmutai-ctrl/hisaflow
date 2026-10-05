-- CreateEnum
CREATE TYPE "TableOrderStatus" AS ENUM ('OPEN', 'PAID', 'VOIDED');

-- CreateEnum
CREATE TYPE "BusinessTxType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "NoteImportance" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NoteStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CreditStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "FeeInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIAL', 'PAID', 'VOIDED');

-- CreateEnum
CREATE TYPE "SubscriberStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CHURNED');

-- CreateEnum
CREATE TYPE "ConnectionType" AS ENUM ('PPPOE', 'HOTSPOT', 'STATIC_IP');

-- CreateEnum
CREATE TYPE "WorkOrderType" AS ENUM ('INSTALLATION', 'REPAIR', 'RELOCATION');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUALLY');

-- CreateEnum
CREATE TYPE "RouterStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "RouterActionType" AS ENUM ('SUSPEND', 'RECONNECT');

-- CreateEnum
CREATE TYPE "RouterActionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "HisaflowPlanTier" AS ENUM ('SOLO', 'TEAM', 'GROWTH');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'GRACE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SubscriptionPaymentMethod" AS ENUM ('CARD', 'MPESA');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'SUPPORT_ADMIN', 'BILLING_ADMIN', 'MARKETING_ADMIN', 'OPERATIONS_ADMIN');

-- CreateEnum
CREATE TYPE "CommunicationOptOutStatus" AS ENUM ('OPTED_IN', 'OPTED_OUT');

-- CreateEnum
CREATE TYPE "BulkSendChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "BulkSendStatus" AS ENUM ('DRAFT', 'SENDING', 'SENT', 'PARTIAL_FAILURE', 'FAILED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "WorkItemPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "WorkItemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "EtimsIntegrationType" AS ENUM ('VSCU', 'OSCU');

-- CreateEnum
CREATE TYPE "EtimsRegistrationStatus" AS ENUM ('PIN_CAPTURED', 'PENDING_KRA_APPROVAL', 'SANDBOX_ACTIVE', 'PENDING_PRODUCTION', 'PRODUCTION_ACTIVE', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "EtimsEnvironment" AS ENUM ('SANDBOX', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "TaxInvoiceStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "TaxSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "TaxSyncErrorClass" AS ENUM ('NETWORK_OFFLINE', 'KRA_ERROR', 'LOCAL_VSCU_ERROR');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AlertType" ADD VALUE 'DAILY_INSIGHT';
ALTER TYPE "AlertType" ADD VALUE 'STAFF_ACTIVITY';
ALTER TYPE "AlertType" ADD VALUE 'ROUTER_DRIFT';
ALTER TYPE "AlertType" ADD VALUE 'BILLING_PAYMENT_DUE';
ALTER TYPE "AlertType" ADD VALUE 'TAX_SYNC_FAILED';
ALTER TYPE "AlertType" ADD VALUE 'TAX_RECONCILIATION_MISMATCH';

-- AlterEnum
ALTER TYPE "CatalogSource" ADD VALUE 'UPC_ITEM_DB';

-- DropForeignKey
ALTER TABLE "alerts" DROP CONSTRAINT "alerts_item_id_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_booking_id_fkey";

-- DropIndex
DROP INDEX "idx_inventory_items_name_trgm";

-- AlterTable
ALTER TABLE "alerts" ALTER COLUMN "item_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "batch_number" TEXT,
ADD COLUMN     "expiry_date" TIMESTAMP(3),
ADD COLUMN     "is_composite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "measure_unit" TEXT,
ADD COLUMN     "measure_value" DECIMAL(12,3),
ADD COLUMN     "product_id" TEXT,
ADD COLUMN     "serial_number" TEXT;

-- AlterTable
ALTER TABLE "inventory_transactions" ADD COLUMN     "client_name" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "subscriber_id" TEXT,
ADD COLUMN     "work_order_id" TEXT;

-- AlterTable
ALTER TABLE "invoice_line_items" ADD COLUMN     "net_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tax_rate" DECIMAL(5,4) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "due_date" TIMESTAMP(3),
ADD COLUMN     "plan_id" TEXT,
ADD COLUMN     "subscriber_id" TEXT,
ADD COLUMN     "suspended_for_non_payment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tax_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
ALTER COLUMN "booking_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "org_memberships" ADD COLUMN     "granted_permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "revoked_permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packaging_units" (
    "id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity_per_unit" INTEGER NOT NULL,
    "barcode" TEXT,
    "cost_price" DECIMAL(12,2),
    "selling_price" DECIMAL(12,2),

    CONSTRAINT "packaging_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiered_price_rules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "min_quantity" DECIMAL(12,3) NOT NULL,
    "price_per_unit" DECIMAL(12,2) NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiered_price_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_batches" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "batch_number" TEXT NOT NULL,
    "expiry_date" TIMESTAMP(3) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "cost_price" DECIMAL(12,2),
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "id" TEXT NOT NULL,
    "composite_item_id" TEXT NOT NULL,
    "ingredient_id" TEXT NOT NULL,
    "quantity_used" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "table_orders" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "table_label" TEXT NOT NULL,
    "status" "TableOrderStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "table_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "table_order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "table_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_transactions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "BusinessTxType" NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "staff_name" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrence_rule" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "importance" "NoteImportance" NOT NULL DEFAULT 'MEDIUM',
    "status" "NoteStatus" NOT NULL DEFAULT 'OPEN',
    "due_date" TIMESTAMP(3),
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_restrictions" (
    "id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_items" (
    "id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "transaction_id" TEXT,
    "amountTotal" DECIMAL(12,2) NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "due_date" TIMESTAMP(3),
    "status" "CreditStatus" NOT NULL DEFAULT 'UNPAID',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_classes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stream" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "class_id" TEXT,
    "admission_number" TEXT,
    "name" TEXT NOT NULL,
    "date_of_birth" TIMESTAMP(3),
    "guardian_name" TEXT,
    "guardian_phone" TEXT,
    "guardian_email" TEXT,
    "guardian_relation" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_terms" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_structures" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "class_id" TEXT,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_invoices" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "status" "FeeInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "total_expected" DECIMAL(12,2) NOT NULL,
    "adjustments_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "issued_at" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_line_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "is_waived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_payments" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscribers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "connection_type" "ConnectionType" NOT NULL DEFAULT 'PPPOE',
    "plan_id" TEXT,
    "router_id" TEXT,
    "router_account_ref" TEXT,
    "status" "SubscriberStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_plans" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "connection_type" "ConnectionType" NOT NULL DEFAULT 'PPPOE',
    "speed_mbps" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subscriber_id" TEXT NOT NULL,
    "type" "WorkOrderType" NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduled_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "technician_name" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subscriber_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 8729,
    "api_username" TEXT NOT NULL,
    "api_password_enc" TEXT NOT NULL,
    "connection_status" "RouterStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "last_tested_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "router_actions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subscriber_id" TEXT NOT NULL,
    "router_id" TEXT NOT NULL,
    "type" "RouterActionType" NOT NULL,
    "status" "RouterActionStatus" NOT NULL DEFAULT 'PENDING',
    "triggered_by" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "router_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hisaflow_plans" (
    "id" TEXT NOT NULL,
    "tier" "HisaflowPlanTier" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_kes" DECIMAL(12,2) NOT NULL,
    "billing_interval" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "seat_allowance" INTEGER NOT NULL,
    "per_seat_overage_kes" DECIMAL(12,2),
    "paystack_plan_code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hisaflow_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "seat_count" INTEGER NOT NULL DEFAULT 1,
    "seat_allowance" INTEGER NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "payment_method" "SubscriptionPaymentMethod" NOT NULL,
    "mpesa_phone" TEXT,
    "renewal_reminder_sent_at" TIMESTAMP(3),
    "next_renewal_date" TIMESTAMP(3),
    "paystack_subscription_code" TEXT,
    "paystack_customer_code" TEXT,
    "pending_tier" "HisaflowPlanTier",
    "pending_plan_effective_at" TIMESTAMP(3),
    "trial_ends_at" TIMESTAMP(3),
    "grace_ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "hisaflow_plan_id" TEXT,
    "amount_kes" DECIMAL(12,2) NOT NULL,
    "method" "SubscriptionPaymentMethod" NOT NULL,
    "paystack_reference" TEXT,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "error_message" TEXT,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'paystack',
    "event_type" TEXT NOT NULL,
    "paystack_reference" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "organization_id" TEXT,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "error_message" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "clerk_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "target_label" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_access_logs" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "admin_name" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "org_name" TEXT NOT NULL,
    "access_reason" TEXT NOT NULL,
    "reason_note" TEXT,
    "accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_consents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "clerk_user_id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "email_status" "CommunicationOptOutStatus" NOT NULL DEFAULT 'OPTED_IN',
    "sms_status" "CommunicationOptOutStatus" NOT NULL DEFAULT 'OPTED_IN',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulk_send_logs" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "admin_name" TEXT NOT NULL,
    "channel" "BulkSendChannel" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "recipient_count" INTEGER NOT NULL,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "status" "BulkSendStatus" NOT NULL DEFAULT 'DRAFT',
    "filter_summary" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bulk_send_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_deliveries" (
    "id" TEXT NOT NULL,
    "bulk_send_log_id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "channel" "BulkSendChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "BulkSendChannel" NOT NULL DEFAULT 'EMAIL',
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "template_name" TEXT,
    "segment_criteria" JSONB NOT NULL,
    "scheduled_at" TIMESTAMP(3),
    "executed_at" TIMESTAMP(3),
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "delivered_count" INTEGER NOT NULL DEFAULT 0,
    "opened_count" INTEGER NOT NULL DEFAULT 0,
    "clicked_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_admin_id" TEXT NOT NULL,
    "created_by_admin_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_work_items" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "WorkItemPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "WorkItemStatus" NOT NULL DEFAULT 'OPEN',
    "organization_id" TEXT,
    "organization_name" TEXT,
    "assigned_to_admin_id" TEXT,
    "assigned_to_admin_name" TEXT,
    "created_by_admin_id" TEXT NOT NULL,
    "created_by_admin_name" TEXT NOT NULL,
    "resolution_note" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_work_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impersonation_tokens" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "admin_name" TEXT NOT NULL,
    "target_org_id" TEXT NOT NULL,
    "target_org_name" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impersonation_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_registrations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kra_pin" TEXT NOT NULL,
    "integration_type" "EtimsIntegrationType" NOT NULL DEFAULT 'VSCU',
    "status" "EtimsRegistrationStatus" NOT NULL DEFAULT 'PIN_CAPTURED',
    "environment" "EtimsEnvironment" NOT NULL DEFAULT 'SANDBOX',
    "commitment_form_acknowledged_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "kra_approved_at" TIMESTAMP(3),
    "production_submitted_at" TIMESTAMP(3),
    "production_activated_at" TIMESTAMP(3),
    "status_note" TEXT,
    "status_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_invoice_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "status" "TaxInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "net_amount" DECIMAL(12,2) NOT NULL,
    "tax_amount" DECIMAL(12,2) NOT NULL,
    "gross_amount" DECIMAL(12,2) NOT NULL,
    "tax_rate" DECIMAL(5,4) NOT NULL,
    "vscu_receipt_number" TEXT,
    "vscu_internal_data" TEXT,
    "vscu_receipt_signature" TEXT,
    "signed_at" TIMESTAMP(3),
    "kra_invoice_number" TEXT,
    "synced_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_invoice_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_sync_queue" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "tax_invoice_record_id" TEXT NOT NULL,
    "status" "TaxSyncStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "kra_error_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3),
    "last_attempt_at" TIMESTAMP(3),
    "last_error" TEXT,
    "last_error_class" "TaxSyncErrorClass",
    "enqueued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_sync_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "products_organization_id_idx" ON "products"("organization_id");

-- CreateIndex
CREATE INDEX "packaging_units_variant_id_idx" ON "packaging_units"("variant_id");

-- CreateIndex
CREATE INDEX "tiered_price_rules_inventory_item_id_idx" ON "tiered_price_rules"("inventory_item_id");

-- CreateIndex
CREATE INDEX "tiered_price_rules_organization_id_idx" ON "tiered_price_rules"("organization_id");

-- CreateIndex
CREATE INDEX "stock_batches_inventory_item_id_expiry_date_idx" ON "stock_batches"("inventory_item_id", "expiry_date");

-- CreateIndex
CREATE INDEX "stock_batches_organization_id_idx" ON "stock_batches"("organization_id");

-- CreateIndex
CREATE INDEX "recipe_ingredients_composite_item_id_idx" ON "recipe_ingredients"("composite_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_ingredients_composite_item_id_ingredient_id_key" ON "recipe_ingredients"("composite_item_id", "ingredient_id");

-- CreateIndex
CREATE INDEX "table_orders_organization_id_status_idx" ON "table_orders"("organization_id", "status");

-- CreateIndex
CREATE INDEX "table_order_items_order_id_idx" ON "table_order_items"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "business_transactions_organization_id_date_idx" ON "business_transactions"("organization_id", "date");

-- CreateIndex
CREATE INDEX "business_transactions_organization_id_type_idx" ON "business_transactions"("organization_id", "type");

-- CreateIndex
CREATE INDEX "notes_organization_id_status_idx" ON "notes"("organization_id", "status");

-- CreateIndex
CREATE INDEX "notes_organization_id_due_date_idx" ON "notes"("organization_id", "due_date");

-- CreateIndex
CREATE INDEX "notes_organization_id_importance_idx" ON "notes"("organization_id", "importance");

-- CreateIndex
CREATE INDEX "note_restrictions_user_id_idx" ON "note_restrictions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "note_restrictions_note_id_user_id_key" ON "note_restrictions"("note_id", "user_id");

-- CreateIndex
CREATE INDEX "checklist_items_note_id_idx" ON "checklist_items"("note_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_records_transaction_id_key" ON "credit_records"("transaction_id");

-- CreateIndex
CREATE INDEX "credit_records_organization_id_status_idx" ON "credit_records"("organization_id", "status");

-- CreateIndex
CREATE INDEX "school_classes_organization_id_idx" ON "school_classes"("organization_id");

-- CreateIndex
CREATE INDEX "students_organization_id_idx" ON "students"("organization_id");

-- CreateIndex
CREATE INDEX "students_organization_id_class_id_idx" ON "students"("organization_id", "class_id");

-- CreateIndex
CREATE INDEX "academic_terms_organization_id_idx" ON "academic_terms"("organization_id");

-- CreateIndex
CREATE INDEX "fee_structures_term_id_class_id_idx" ON "fee_structures"("term_id", "class_id");

-- CreateIndex
CREATE INDEX "fee_invoices_organization_id_status_idx" ON "fee_invoices"("organization_id", "status");

-- CreateIndex
CREATE INDEX "fee_invoices_organization_id_term_id_idx" ON "fee_invoices"("organization_id", "term_id");

-- CreateIndex
CREATE UNIQUE INDEX "fee_invoices_student_id_term_id_key" ON "fee_invoices"("student_id", "term_id");

-- CreateIndex
CREATE INDEX "fee_line_items_invoice_id_idx" ON "fee_line_items"("invoice_id");

-- CreateIndex
CREATE INDEX "fee_payments_invoice_id_idx" ON "fee_payments"("invoice_id");

-- CreateIndex
CREATE INDEX "subscribers_organization_id_idx" ON "subscribers"("organization_id");

-- CreateIndex
CREATE INDEX "subscribers_organization_id_status_idx" ON "subscribers"("organization_id", "status");

-- CreateIndex
CREATE INDEX "service_plans_organization_id_idx" ON "service_plans"("organization_id");

-- CreateIndex
CREATE INDEX "work_orders_organization_id_idx" ON "work_orders"("organization_id");

-- CreateIndex
CREATE INDEX "work_orders_organization_id_status_idx" ON "work_orders"("organization_id", "status");

-- CreateIndex
CREATE INDEX "work_orders_subscriber_id_idx" ON "work_orders"("subscriber_id");

-- CreateIndex
CREATE INDEX "tickets_organization_id_idx" ON "tickets"("organization_id");

-- CreateIndex
CREATE INDEX "tickets_organization_id_status_idx" ON "tickets"("organization_id", "status");

-- CreateIndex
CREATE INDEX "tickets_subscriber_id_idx" ON "tickets"("subscriber_id");

-- CreateIndex
CREATE INDEX "routers_organization_id_idx" ON "routers"("organization_id");

-- CreateIndex
CREATE INDEX "router_actions_organization_id_status_idx" ON "router_actions"("organization_id", "status");

-- CreateIndex
CREATE INDEX "router_actions_subscriber_id_idx" ON "router_actions"("subscriber_id");

-- CreateIndex
CREATE UNIQUE INDEX "hisaflow_plans_tier_key" ON "hisaflow_plans"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_organization_id_key" ON "subscriptions"("organization_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_next_renewal_date_idx" ON "subscriptions"("next_renewal_date");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_paystack_reference_key" ON "payment_attempts"("paystack_reference");

-- CreateIndex
CREATE INDEX "payment_attempts_organization_id_status_idx" ON "payment_attempts"("organization_id", "status");

-- CreateIndex
CREATE INDEX "payment_attempts_subscription_id_idx" ON "payment_attempts"("subscription_id");

-- CreateIndex
CREATE INDEX "payment_attempts_hisaflow_plan_id_idx" ON "payment_attempts"("hisaflow_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_idempotency_key_key" ON "webhook_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "webhook_events_event_type_idx" ON "webhook_events"("event_type");

-- CreateIndex
CREATE INDEX "webhook_events_paystack_reference_idx" ON "webhook_events"("paystack_reference");

-- CreateIndex
CREATE INDEX "webhook_events_organization_id_idx" ON "webhook_events"("organization_id");

-- CreateIndex
CREATE INDEX "webhook_events_status_idx" ON "webhook_events"("status");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_clerk_id_key" ON "admin_users"("clerk_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_audit_logs_admin_id_idx" ON "admin_audit_logs"("admin_id");

-- CreateIndex
CREATE INDEX "admin_audit_logs_target_type_target_id_idx" ON "admin_audit_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "admin_audit_logs_action_type_idx" ON "admin_audit_logs"("action_type");

-- CreateIndex
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "message_access_logs_org_id_idx" ON "message_access_logs"("org_id");

-- CreateIndex
CREATE INDEX "message_access_logs_admin_id_idx" ON "message_access_logs"("admin_id");

-- CreateIndex
CREATE INDEX "message_access_logs_accessed_at_idx" ON "message_access_logs"("accessed_at");

-- CreateIndex
CREATE UNIQUE INDEX "communication_consents_clerk_user_id_key" ON "communication_consents"("clerk_user_id");

-- CreateIndex
CREATE INDEX "communication_consents_organization_id_idx" ON "communication_consents"("organization_id");

-- CreateIndex
CREATE INDEX "bulk_send_logs_admin_id_idx" ON "bulk_send_logs"("admin_id");

-- CreateIndex
CREATE INDEX "bulk_send_logs_created_at_idx" ON "bulk_send_logs"("created_at");

-- CreateIndex
CREATE INDEX "campaign_deliveries_bulk_send_log_id_idx" ON "campaign_deliveries"("bulk_send_log_id");

-- CreateIndex
CREATE INDEX "campaign_deliveries_recipient_idx" ON "campaign_deliveries"("recipient");

-- CreateIndex
CREATE INDEX "marketing_campaigns_status_idx" ON "marketing_campaigns"("status");

-- CreateIndex
CREATE INDEX "marketing_campaigns_scheduled_at_idx" ON "marketing_campaigns"("scheduled_at");

-- CreateIndex
CREATE INDEX "admin_work_items_status_idx" ON "admin_work_items"("status");

-- CreateIndex
CREATE INDEX "admin_work_items_priority_idx" ON "admin_work_items"("priority");

-- CreateIndex
CREATE INDEX "admin_work_items_assigned_to_admin_id_idx" ON "admin_work_items"("assigned_to_admin_id");

-- CreateIndex
CREATE INDEX "admin_work_items_organization_id_idx" ON "admin_work_items"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "impersonation_tokens_token_key" ON "impersonation_tokens"("token");

-- CreateIndex
CREATE INDEX "impersonation_tokens_admin_id_idx" ON "impersonation_tokens"("admin_id");

-- CreateIndex
CREATE INDEX "impersonation_tokens_target_org_id_idx" ON "impersonation_tokens"("target_org_id");

-- CreateIndex
CREATE INDEX "impersonation_tokens_expires_at_idx" ON "impersonation_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "tax_registrations_organization_id_key" ON "tax_registrations"("organization_id");

-- CreateIndex
CREATE INDEX "tax_registrations_status_idx" ON "tax_registrations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tax_invoice_records_invoice_id_key" ON "tax_invoice_records"("invoice_id");

-- CreateIndex
CREATE INDEX "tax_invoice_records_organization_id_status_idx" ON "tax_invoice_records"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tax_sync_queue_tax_invoice_record_id_key" ON "tax_sync_queue"("tax_invoice_record_id");

-- CreateIndex
CREATE INDEX "tax_sync_queue_organization_id_status_idx" ON "tax_sync_queue"("organization_id", "status");

-- CreateIndex
CREATE INDEX "tax_sync_queue_status_next_attempt_at_idx" ON "tax_sync_queue"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "inventory_items_product_id_idx" ON "inventory_items"("product_id");

-- CreateIndex
CREATE INDEX "inventory_items_organization_id_barcode_idx" ON "inventory_items"("organization_id", "barcode");

-- CreateIndex
CREATE INDEX "inventory_transactions_subscriber_id_idx" ON "inventory_transactions"("subscriber_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_work_order_id_idx" ON "inventory_transactions"("work_order_id");

-- CreateIndex
CREATE INDEX "invoices_subscriber_id_idx" ON "invoices"("subscriber_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packaging_units" ADD CONSTRAINT "packaging_units_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiered_price_rules" ADD CONSTRAINT "tiered_price_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiered_price_rules" ADD CONSTRAINT "tiered_price_rules_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_composite_item_id_fkey" FOREIGN KEY ("composite_item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_orders" ADD CONSTRAINT "table_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_order_items" ADD CONSTRAINT "table_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "table_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_order_items" ADD CONSTRAINT "table_order_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_transactions" ADD CONSTRAINT "business_transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_restrictions" ADD CONSTRAINT "note_restrictions_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_restrictions" ADD CONSTRAINT "note_restrictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_records" ADD CONSTRAINT "credit_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_records" ADD CONSTRAINT "credit_records_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "inventory_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "service_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_classes" ADD CONSTRAINT "school_classes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "school_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_terms" ADD CONSTRAINT "academic_terms_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "academic_terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "school_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "academic_terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_line_items" ADD CONSTRAINT "fee_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "fee_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "fee_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "service_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_router_id_fkey" FOREIGN KEY ("router_id") REFERENCES "routers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_plans" ADD CONSTRAINT "service_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routers" ADD CONSTRAINT "routers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "router_actions" ADD CONSTRAINT "router_actions_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "router_actions" ADD CONSTRAINT "router_actions_router_id_fkey" FOREIGN KEY ("router_id") REFERENCES "routers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "hisaflow_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_hisaflow_plan_id_fkey" FOREIGN KEY ("hisaflow_plan_id") REFERENCES "hisaflow_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_deliveries" ADD CONSTRAINT "campaign_deliveries_bulk_send_log_id_fkey" FOREIGN KEY ("bulk_send_log_id") REFERENCES "bulk_send_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_registrations" ADD CONSTRAINT "tax_registrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_invoice_records" ADD CONSTRAINT "tax_invoice_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_invoice_records" ADD CONSTRAINT "tax_invoice_records_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_sync_queue" ADD CONSTRAINT "tax_sync_queue_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_sync_queue" ADD CONSTRAINT "tax_sync_queue_tax_invoice_record_id_fkey" FOREIGN KEY ("tax_invoice_record_id") REFERENCES "tax_invoice_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
