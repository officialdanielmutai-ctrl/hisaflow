-- Assistant foundation (overhaul Duty 2, Phase B): durable proposals,
-- privacy-safe audit log, and a scoped feature-flag table. No Organization
-- relation is added; tenant scoping is enforced in code.

CREATE TYPE "AssistantProposalStatus" AS ENUM (
    'PROPOSED', 'APPROVED', 'REJECTED', 'EXPIRED', 'EXECUTED', 'FAILED'
);

CREATE TYPE "FeatureFlagScope" AS ENUM ('GLOBAL', 'BUSINESS_TYPE', 'ORGANIZATION');

CREATE TABLE "assistant_proposals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "tool" TEXT NOT NULL,
    "args_json" TEXT NOT NULL,
    "args_hash" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "diff_json" TEXT,
    "risk_level" TEXT NOT NULL,
    "status" "AssistantProposalStatus" NOT NULL DEFAULT 'PROPOSED',
    "idempotency_key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "decided_at" TIMESTAMP(3),
    "decided_by" TEXT,
    "executed_at" TIMESTAMP(3),
    "result_json" TEXT,
    "error_message" TEXT,

    CONSTRAINT "assistant_proposals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assistant_proposals_idempotency_key_key"
    ON "assistant_proposals"("idempotency_key");
CREATE INDEX "assistant_proposals_organization_id_status_idx"
    ON "assistant_proposals"("organization_id", "status");
CREATE INDEX "assistant_proposals_organization_id_created_at_idx"
    ON "assistant_proposals"("organization_id", "created_at");

CREATE TABLE "assistant_audit_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT,
    "proposal_id" TEXT,
    "tool" TEXT,
    "action" TEXT NOT NULL,
    "detail_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assistant_audit_logs_organization_id_created_at_idx"
    ON "assistant_audit_logs"("organization_id", "created_at");
CREATE INDEX "assistant_audit_logs_proposal_id_idx"
    ON "assistant_audit_logs"("proposal_id");

CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" "FeatureFlagScope" NOT NULL DEFAULT 'GLOBAL',
    "scope_value" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rollout_pct" INTEGER NOT NULL DEFAULT 100,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feature_flags_key_scope_scope_value_key"
    ON "feature_flags"("key", "scope", "scope_value");
CREATE INDEX "feature_flags_key_scope_idx" ON "feature_flags"("key", "scope");
