-- Room fault/maintenance reporting (guest house): a new OUT_OF_ORDER room
-- status and a room_issues ledger with a mandatory description and optional
-- repair cost. Additive; no existing rows are touched.

-- AlterEnum
ALTER TYPE "RoomStatus" ADD VALUE 'OUT_OF_ORDER';

-- CreateEnum
CREATE TYPE "RoomIssueStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "room_issues" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'REPAIR',
    "cost" DECIMAL(12,2),
    "status" "RoomIssueStatus" NOT NULL DEFAULT 'OPEN',
    "reported_by_id" TEXT,
    "reported_by_name" TEXT,
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "room_issues_organization_id_room_id_idx" ON "room_issues"("organization_id", "room_id");

-- CreateIndex
CREATE INDEX "room_issues_organization_id_status_idx" ON "room_issues"("organization_id", "status");

-- AddForeignKey
ALTER TABLE "room_issues" ADD CONSTRAINT "room_issues_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_issues" ADD CONSTRAINT "room_issues_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
