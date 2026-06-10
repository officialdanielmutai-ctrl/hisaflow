-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('CRITICAL', 'WARNING', 'INFO');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('LOW_STOCK', 'OUT_OF_STOCK', 'DEAD_STOCK', 'EXPIRY_RISK', 'VARIANCE');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('UNRESOLVED', 'RESOLVED', 'SNOOZED');

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'UNRESOLVED',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alerts_organization_id_status_idx" ON "alerts"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "alerts_organization_id_item_id_type_key" ON "alerts"("organization_id", "item_id", "type");

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
