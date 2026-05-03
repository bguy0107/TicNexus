/*
  Warnings:

  - Made the column `locationNumber` on table `Location` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Location" ALTER COLUMN "locationNumber" SET NOT NULL;
