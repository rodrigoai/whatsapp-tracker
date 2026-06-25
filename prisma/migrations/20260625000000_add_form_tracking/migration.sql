CREATE TABLE "FormTracking" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "selector" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormTracking_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FormTracking_accountId_idx" ON "FormTracking"("accountId");

ALTER TABLE "FormTracking" ADD CONSTRAINT "FormTracking_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
