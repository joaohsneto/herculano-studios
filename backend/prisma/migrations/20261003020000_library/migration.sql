ALTER TYPE "ProductType" ADD VALUE 'COURSE';
ALTER TYPE "ProductType" ADD VALUE 'EBOOK';
ALTER TYPE "ProductType" ADD VALUE 'TEMPLATE';
ALTER TYPE "ProductType" ADD VALUE 'DIGITAL_PRODUCT';
ALTER TABLE "Product" ADD COLUMN "deliveryInstructions" TEXT;
DROP INDEX "MediaAsset_variantId_key";
CREATE INDEX "MediaAsset_variantId_idx" ON "MediaAsset"("variantId");
