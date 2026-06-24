-- Add invite_code column to organizations table
-- This allows owners to share a unique code with staff who join via the onboarding flow

ALTER TABLE "organizations" ADD COLUMN "invite_code" TEXT;

ALTER TABLE "organizations" ADD CONSTRAINT "organizations_invite_code_key" UNIQUE ("invite_code");
