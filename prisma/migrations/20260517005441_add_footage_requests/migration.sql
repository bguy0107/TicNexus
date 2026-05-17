-- CreateEnum
CREATE TYPE "FootageRequestStatus" AS ENUM ('PENDING', 'FULFILLED', 'DENIED');

-- CreateEnum
CREATE TYPE "RequestingParty" AS ENUM ('LAW_ENFORCEMENT', 'INTERNAL');

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "departments" DROP DEFAULT;

-- CreateTable
CREATE TABLE "FootageRequest" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "cameraArea" TEXT NOT NULL,
    "requestingParty" "RequestingParty" NOT NULL,
    "officerName" TEXT,
    "status" "FootageRequestStatus" NOT NULL DEFAULT 'PENDING',
    "resolutionNote" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FootageRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FootageRequest_locationId_idx" ON "FootageRequest"("locationId");

-- CreateIndex
CREATE INDEX "FootageRequest_createdById_idx" ON "FootageRequest"("createdById");

-- CreateIndex
CREATE INDEX "FootageRequest_status_idx" ON "FootageRequest"("status");

-- AddForeignKey
ALTER TABLE "FootageRequest" ADD CONSTRAINT "FootageRequest_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FootageRequest" ADD CONSTRAINT "FootageRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FootageRequest" ADD CONSTRAINT "FootageRequest_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
