-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nextAttendantIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ButtonConfig" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "position" TEXT NOT NULL DEFAULT 'RIGHT',
    "size" TEXT NOT NULL DEFAULT 'LARGE',
    "primaryColor" TEXT NOT NULL DEFAULT '#25D366',
    "buttonText" TEXT NOT NULL DEFAULT 'Chat with us',
    "balloonText" TEXT NOT NULL DEFAULT 'Olá! Preencha seus dados para iniciarmos seu atendimento pelo WhatsApp.',
    "allowedOrigins" TEXT NOT NULL DEFAULT '*',
    "gclidExpirationDays" INTEGER NOT NULL DEFAULT 30,
    "conversionName" TEXT NOT NULL DEFAULT 'WhatsApp Conversion',
    "gaEventName" TEXT NOT NULL DEFAULT 'whatsapp_form_submit',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ButtonConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendant" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "gclid" TEXT,
    "gbraid" TEXT,
    "wbraid" TEXT,
    "utm_source" TEXT,
    "utm_campaign" TEXT,
    "utm_medium" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "conversionTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" TEXT,
    "conversionName" TEXT NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ButtonConfig_accountId_key" ON "ButtonConfig"("accountId");

-- CreateIndex
CREATE INDEX "Attendant_accountId_idx" ON "Attendant"("accountId");

-- CreateIndex
CREATE INDEX "Customer_accountId_conversionTime_idx" ON "Customer"("accountId", "conversionTime");

-- CreateIndex
CREATE INDEX "Customer_accountId_email_idx" ON "Customer"("accountId", "email");

-- CreateIndex
CREATE INDEX "Customer_accountId_phone_idx" ON "Customer"("accountId", "phone");

-- AddForeignKey
ALTER TABLE "ButtonConfig" ADD CONSTRAINT "ButtonConfig_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendant" ADD CONSTRAINT "Attendant_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
