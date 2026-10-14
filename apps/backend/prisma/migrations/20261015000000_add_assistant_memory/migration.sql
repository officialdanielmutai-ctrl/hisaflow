-- Assistant conversation memory (overhaul Duty 2): short-lived thread memory
-- that is pruned as chats pile on. Additive; no Organization relation.

CREATE TABLE "assistant_conversations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_conversations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assistant_conversations_organization_id_user_id_last_message_at_idx"
    ON "assistant_conversations"("organization_id", "user_id", "last_message_at");

CREATE TABLE "assistant_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assistant_messages_conversation_id_created_at_idx"
    ON "assistant_messages"("conversation_id", "created_at");

ALTER TABLE "assistant_messages"
    ADD CONSTRAINT "assistant_messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "assistant_conversations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
