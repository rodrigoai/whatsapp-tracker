-- Safe migration: convert status String? to String[]
-- Add new array column, backfill from old string column, swap
ALTER TABLE "Customer" ADD COLUMN "status_new" TEXT[] NOT NULL DEFAULT '{}';
UPDATE "Customer" SET "status_new" = ARRAY["status"] WHERE "status" IS NOT NULL;
ALTER TABLE "Customer" DROP COLUMN "status";
ALTER TABLE "Customer" RENAME COLUMN "status_new" TO "status";
