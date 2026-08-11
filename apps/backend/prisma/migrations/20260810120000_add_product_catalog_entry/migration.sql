-- CreateEnum
CREATE TYPE "CatalogSource" AS ENUM ('MANUAL', 'OCR', 'OPEN_FOOD_FACTS');

-- CreateTable
CREATE TABLE "product_catalog_entries" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "category" TEXT,
    "unit" TEXT,
    "image_url" TEXT,
    "source" "CatalogSource" NOT NULL DEFAULT 'MANUAL',
    "confirmations" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_catalog_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_catalog_entries_barcode_key" ON "product_catalog_entries"("barcode");
