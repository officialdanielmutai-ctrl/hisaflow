-- Advisory plan intent captured at sign-up (public pricing CTA carries
-- ?plan=solo|team). Stored as a preference only; it is never a purchase and
-- drives no billing by itself.
ALTER TABLE "organizations" ADD COLUMN "preferred_plan" TEXT;
