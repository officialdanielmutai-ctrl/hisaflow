-- Business branding: a public logo URL for each organisation. Additive;
-- existing organisations simply have no override and fall back to the
-- email-domain logo or a monogram.

ALTER TABLE "organizations" ADD COLUMN "logo_url" TEXT;
