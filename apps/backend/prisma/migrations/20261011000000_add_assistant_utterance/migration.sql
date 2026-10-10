-- Consented, anonymised AI turns for the assistant golden set
-- (overhaul Duty 2). No organization/user/message identifier is stored.
CREATE TABLE "assistant_utterances" (
    "id" TEXT NOT NULL,
    "business_type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "redacted_text" TEXT NOT NULL,
    "consent_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_utterances_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assistant_utterances_business_type_created_at_idx"
    ON "assistant_utterances"("business_type", "created_at");
