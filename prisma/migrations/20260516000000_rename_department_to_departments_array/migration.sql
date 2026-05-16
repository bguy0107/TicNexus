-- Migrate single department to departments array
ALTER TABLE "User" ADD COLUMN "departments" "Department"[] NOT NULL DEFAULT '{}';
UPDATE "User" SET "departments" = ARRAY["department"] WHERE "department" IS NOT NULL;
ALTER TABLE "User" DROP COLUMN "department";
