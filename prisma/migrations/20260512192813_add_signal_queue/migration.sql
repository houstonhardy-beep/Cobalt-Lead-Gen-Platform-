-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('CONSTRUCTION_PERMIT', 'GOVERNMENT_RFP', 'CUSTOMER_SIGNAL', 'NEWS', 'PERSONNEL_CHANGE');

-- CreateEnum
CREATE TYPE "SignalPriority" AS ENUM ('HOT', 'WARM', 'COLD');

-- CreateEnum
CREATE TYPE "SignalStatus" AS ENUM ('NEW', 'SAVED', 'CONVERTED', 'DISMISSED');

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "SignalType" NOT NULL,
    "priority" "SignalPriority" NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT,
    "location" TEXT,
    "estimatedValue" DOUBLE PRECISION,
    "description" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceName" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "status" "SignalStatus" NOT NULL DEFAULT 'NEW',
    "assignedToId" TEXT,
    "convertedLeadId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "contactName" TEXT,
    "contactTitle" TEXT,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Signal_tenantId_idx" ON "Signal"("tenantId");

-- CreateIndex
CREATE INDEX "Signal_tenantId_status_idx" ON "Signal"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Signal_tenantId_type_idx" ON "Signal"("tenantId", "type");

-- CreateIndex
CREATE INDEX "Signal_tenantId_priority_idx" ON "Signal"("tenantId", "priority");

-- CreateIndex
CREATE INDEX "Signal_assignedToId_idx" ON "Signal"("assignedToId");

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_convertedLeadId_fkey" FOREIGN KEY ("convertedLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
