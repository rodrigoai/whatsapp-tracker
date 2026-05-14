-- AlterTable
ALTER TABLE "Account" ADD COLUMN "nextAttendantIndex" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ButtonConfig" ADD COLUMN "allowedOrigins" TEXT NOT NULL DEFAULT '*';

-- CreateIndex
CREATE INDEX "Attendant_accountId_idx" ON "Attendant"("accountId");
CREATE INDEX "Customer_accountId_conversionTime_idx" ON "Customer"("accountId", "conversionTime");
CREATE INDEX "Customer_accountId_email_idx" ON "Customer"("accountId", "email");
CREATE INDEX "Customer_accountId_phone_idx" ON "Customer"("accountId", "phone");
