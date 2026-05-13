-- AlterEnum
ALTER TYPE "TicketStatus" ADD VALUE 'APPROVED';

-- AlterTable
ALTER TABLE "Franchise" ADD COLUMN     "approvalCostLimit" DECIMAL(10,2);
