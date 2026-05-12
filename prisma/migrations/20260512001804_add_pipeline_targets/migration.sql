-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateTable
CREATE TABLE "PipelineTarget" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "stage" "LeadStage",
    "period" TEXT NOT NULL,
    "periodType" "PeriodType" NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PipelineTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PipelineTarget_tenantId_idx" ON "PipelineTarget"("tenantId");

-- CreateIndex
CREATE INDEX "PipelineTarget_tenantId_period_idx" ON "PipelineTarget"("tenantId", "period");

-- CreateIndex
CREATE INDEX "PipelineTarget_userId_idx" ON "PipelineTarget"("userId");

-- AddForeignKey
ALTER TABLE "PipelineTarget" ADD CONSTRAINT "PipelineTarget_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineTarget" ADD CONSTRAINT "PipelineTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
