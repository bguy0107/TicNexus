-- CreateEnum
CREATE TYPE "Department" AS ENUM ('IT', 'MAINTENANCE');

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "department" "Department";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "department" "Department";
