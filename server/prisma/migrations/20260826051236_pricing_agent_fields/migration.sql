-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "bundleItems" JSONB,
ADD COLUMN     "costPrice" DECIMAL(12,2),
ADD COLUMN     "marketPrice" DECIMAL(12,2);
