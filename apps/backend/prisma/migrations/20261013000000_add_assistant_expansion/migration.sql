-- Assistant expansion (overhaul Duty 2, Phase E): unsupported-intent capture
-- and the outbound-message delivery trail. Additive; no Organization relation.

CREATE TYPE "AssistantOutboundStatus" AS ENUM ('SENT', 'FAILED', 'MOCKED');

CREATE TABLE "assistant_unsupported_intents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT,
    "intent" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_unsupported_intents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assistant_unsupported_intents_organization_id_created_at_idx"
    ON "assistant_unsupported_intents"("organization_id", "created_at");

CREATE TABLE "assistant_outbound_messages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "proposal_id" TEXT,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" "AssistantOutboundStatus" NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_outbound_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assistant_outbound_messages_organization_id_created_at_idx"
    ON "assistant_outbound_messages"("organization_id", "created_at");
