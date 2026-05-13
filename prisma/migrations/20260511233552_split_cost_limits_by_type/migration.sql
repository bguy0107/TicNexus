-- AlterTable
ALTER TABLE "Franchise" DROP COLUMN "approvalCostLimit",
ADD COLUMN "itCostLimit" DECIMAL(10,2),
ADD COLUMN "maintenanceCostLimit" DECIMAL(10,2);
