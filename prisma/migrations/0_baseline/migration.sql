CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AcquisitionSource" AS ENUM ('REFERRAL', 'COLD_OUTREACH', 'RFP', 'INBOUND', 'EXISTING_RELATIONSHIP');

-- CreateEnum (pre-baseline, added for shadow DB replay)
CREATE TYPE "public"."LeadSource" AS ENUM ('REFERRAL', 'SAM_GOV', 'RFP_BID_BOARD', 'DODGE_DATA', 'COLD_OUTREACH', 'INBOUND_WEB', 'EXISTING_CUSTOMER', 'PARTNER_VENDOR');

-- CreateEnum (pre-baseline, added for shadow DB replay)
CREATE TYPE "public"."ProductCategory" AS ENUM ('ACCESS_CONTROL', 'VIDEO_SURVEILLANCE', 'INTRUSION_ALARM', 'INTERCOM_AUDIO', 'NETWORKING_INFRASTRUCTURE', 'FIRE_LIFE_SAFETY', 'STRUCTURED_CABLING', 'AUTO_DOOR_SLIDING', 'AUTO_DOOR_ROTATING', 'AUTO_DOOR_OVERHEAD', 'AUTO_DOOR_SWING', 'AUTO_DOOR_FOLDING', 'MANUAL_DOOR_SLIDING', 'MANUAL_DOOR_ROTATING', 'MANUAL_DOOR_OVERHEAD', 'MANUAL_DOOR_SWING', 'MANUAL_DOOR_FOLDING', 'INTEGRATED_SYSTEMS', 'SYSTEMS_OTHER');

-- CreateEnum
CREATE TYPE "public"."CustomerType" AS ENUM ('NEW_LOGO', 'EXISTING');

-- CreateEnum
CREATE TYPE "public"."IntegrationProvider" AS ENUM ('CONNECTWISE', 'HUBSPOT', 'APOLLO', 'ZOOMINFO', 'DODGE', 'SAM_GOV', 'VERKADA', 'SENDGRID', 'TWILIO', 'MAPBOX');

-- CreateEnum
CREATE TYPE "public"."JobType" AS ENUM ('INSTALL_NEW', 'INSTALL_MAC', 'SERVICE_CONTRACT', 'SERVICE_ONDEMAND', 'BOX_SALE', 'MANAGED_SERVICE');

-- CreateEnum
CREATE TYPE "public"."LeadHeat" AS ENUM ('HOT', 'WARM', 'COLD', 'NURTURE', 'FOLLOWUP', 'CONTACTED');

-- CreateEnum
CREATE TYPE "public"."LeadStage" AS ENUM ('SIGNAL', 'PROSPECT', 'OUTREACH_SENT', 'ENGAGED', 'QUALIFIED', 'PROPOSAL', 'PROPOSAL_SENT', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST', 'NURTURE');

-- CreateEnum
CREATE TYPE "public"."LeadVertical" AS ENUM ('EDUCATION', 'GOVERNMENT', 'COMMERCIAL', 'HEALTHCARE', 'INDUSTRIAL');

-- CreateEnum
CREATE TYPE "public"."OpportunitySource" AS ENUM ('SAM_GOV', 'DODGE', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."OpportunityStatus" AS ENUM ('OPEN', 'PURSUING', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "public"."OpportunityType" AS ENUM ('RFP', 'PERMIT', 'BID', 'GRANT', 'RENEWAL');

-- CreateEnum
CREATE TYPE "public"."OrgSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "public"."OutreachResponse" AS ENUM ('PENDING', 'YES', 'NO', 'OUT_OF_OFFICE');

-- CreateEnum
CREATE TYPE "public"."OutreachType" AS ENUM ('COLD_EMAIL', 'COLD_CALL', 'LINKEDIN', 'FOLLOW_UP', 'POST_QUOTE', 'CONTRACT', 'RFP_COVER', 'SMS');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('REP', 'TENANT_ADMIN', 'COBALT_SUPER_ADMIN');

-- CreateTable
CREATE TABLE "public"."Account" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "public"."Customer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "vertical" "public"."LeadVertical",
    "contractValue" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3),
    "renewalDate" TIMESTAMP(3),
    "verkadaCustomer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "acquisitionSource" "public"."AcquisitionSource",
    "customerType" "public"."CustomerType",
    "decisionMakerTitle" TEXT,
    "employeeCount" INTEGER,
    "orgSize" "public"."OrgSize",
    "squareFootage" INTEGER,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IntegrationConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "public"."IntegrationProvider" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "credentials" JSONB NOT NULL DEFAULT '{}',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Lead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "company" TEXT NOT NULL,
    "contact" TEXT,
    "contactTitle" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "vertical" "public"."LeadVertical",
    "stage" "public"."LeadStage" NOT NULL DEFAULT 'PROSPECT',
    "heat" "public"."LeadHeat" NOT NULL DEFAULT 'COLD',
    "value" DOUBLE PRECISION,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "signal" TEXT,
    "signalSource" TEXT,
    "nextFollowUp" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeadLog" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,

    CONSTRAINT "LeadLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Note" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Opportunity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT,
    "customerId" TEXT,
    "title" TEXT NOT NULL,
    "type" "public"."OpportunityType" NOT NULL,
    "source" "public"."OpportunitySource" NOT NULL DEFAULT 'MANUAL',
    "value" DOUBLE PRECISION,
    "status" "public"."OpportunityStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "estimatedCost" DOUBLE PRECISION,
    "estimatedGPPercent" DOUBLE PRECISION,
    "estimatedGrossProfit" DOUBLE PRECISION,
    "estimatedRevenue" DOUBLE PRECISION,
    "expectedCloseDate" TIMESTAMP(3),
    "jobType" "public"."JobType",
    "probabilityPercent" INTEGER,
    "weightedValue" DOUBLE PRECISION,
    "stage" "public"."LeadStage",
    "stageChangedAt" TIMESTAMP(3),

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OpportunityProduct" (
    "opportunityId" TEXT NOT NULL,
    "productTypeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION,

    CONSTRAINT "OpportunityProduct_pkey" PRIMARY KEY ("opportunityId","productTypeId")
);

-- CreateTable
CREATE TABLE "public"."OutreachLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT,
    "userId" TEXT,
    "type" "public"."OutreachType" NOT NULL,
    "content" TEXT NOT NULL,
    "subject" TEXT,
    "response" "public"."OutreachResponse" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductType" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "defaultMarginPercent" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "public"."StageHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "fromStage" "public"."LeadStage",
    "toStage" "public"."LeadStage" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" TEXT,
    "daysInPreviousStage" INTEGER,
    "opportunityValueAtChange" DOUBLE PRECISION,

    CONSTRAINT "StageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "branding" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "role" "public"."UserRole" NOT NULL DEFAULT 'REP',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "assignedRegionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateIndex
CREATE INDEX "Account_provider_idx" ON "public"."Account"("provider" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Account_userId_provider_key" ON "public"."Account"("userId" ASC, "provider" ASC);

-- CreateIndex
CREATE INDEX "Customer_tenantId_customerType_idx" ON "public"."Customer"("tenantId" ASC, "customerType" ASC);

-- CreateIndex
CREATE INDEX "Customer_tenantId_idx" ON "public"."Customer"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "Customer_tenantId_renewalDate_idx" ON "public"."Customer"("tenantId" ASC, "renewalDate" ASC);

-- CreateIndex
CREATE INDEX "IntegrationConfig_tenantId_idx" ON "public"."IntegrationConfig"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConfig_tenantId_provider_key" ON "public"."IntegrationConfig"("tenantId" ASC, "provider" ASC);

-- CreateIndex
CREATE INDEX "Lead_assignedToId_idx" ON "public"."Lead"("assignedToId" ASC);

-- CreateIndex
CREATE INDEX "Lead_tenantId_heat_idx" ON "public"."Lead"("tenantId" ASC, "heat" ASC);

-- CreateIndex
CREATE INDEX "Lead_tenantId_idx" ON "public"."Lead"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "Lead_tenantId_stage_idx" ON "public"."Lead"("tenantId" ASC, "stage" ASC);

-- CreateIndex
CREATE INDEX "LeadLog_leadId_idx" ON "public"."LeadLog"("leadId" ASC);

-- CreateIndex
CREATE INDEX "Note_leadId_idx" ON "public"."Note"("leadId" ASC);

-- CreateIndex
CREATE INDEX "Note_tenantId_idx" ON "public"."Note"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "Opportunity_customerId_idx" ON "public"."Opportunity"("customerId" ASC);

-- CreateIndex
CREATE INDEX "Opportunity_leadId_idx" ON "public"."Opportunity"("leadId" ASC);

-- CreateIndex
CREATE INDEX "Opportunity_tenantId_expectedCloseDate_idx" ON "public"."Opportunity"("tenantId" ASC, "expectedCloseDate" ASC);

-- CreateIndex
CREATE INDEX "Opportunity_tenantId_idx" ON "public"."Opportunity"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "Opportunity_tenantId_stage_idx" ON "public"."Opportunity"("tenantId" ASC, "stage" ASC);

-- CreateIndex
CREATE INDEX "Opportunity_tenantId_status_idx" ON "public"."Opportunity"("tenantId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "OpportunityProduct_productTypeId_idx" ON "public"."OpportunityProduct"("productTypeId" ASC);

-- CreateIndex
CREATE INDEX "OutreachLog_leadId_idx" ON "public"."OutreachLog"("leadId" ASC);

-- CreateIndex
CREATE INDEX "OutreachLog_tenantId_idx" ON "public"."OutreachLog"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "ProductType_tenantId_idx" ON "public"."ProductType"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_tenantId_name_key" ON "public"."ProductType"("tenantId" ASC, "name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken" ASC);

-- CreateIndex
CREATE INDEX "StageHistory_opportunityId_idx" ON "public"."StageHistory"("opportunityId" ASC);

-- CreateIndex
CREATE INDEX "StageHistory_tenantId_changedAt_idx" ON "public"."StageHistory"("tenantId" ASC, "changedAt" ASC);

-- CreateIndex
CREATE INDEX "StageHistory_tenantId_idx" ON "public"."StageHistory"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "StageHistory_tenantId_toStage_idx" ON "public"."StageHistory"("tenantId" ASC, "toStage" ASC);

-- CreateIndex
CREATE INDEX "Tenant_slug_idx" ON "public"."Tenant"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "public"."Tenant"("slug" ASC);

-- CreateIndex
CREATE INDEX "User_email_idx" ON "public"."User"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "public"."User"("tenantId" ASC);

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Customer" ADD CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IntegrationConfig" ADD CONSTRAINT "IntegrationConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Lead" ADD CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Lead" ADD CONSTRAINT "Lead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeadLog" ADD CONSTRAINT "LeadLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeadLog" ADD CONSTRAINT "LeadLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Note" ADD CONSTRAINT "Note_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Note" ADD CONSTRAINT "Note_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Opportunity" ADD CONSTRAINT "Opportunity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Opportunity" ADD CONSTRAINT "Opportunity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Opportunity" ADD CONSTRAINT "Opportunity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OpportunityProduct" ADD CONSTRAINT "OpportunityProduct_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "public"."Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OpportunityProduct" ADD CONSTRAINT "OpportunityProduct_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "public"."ProductType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OutreachLog" ADD CONSTRAINT "OutreachLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OutreachLog" ADD CONSTRAINT "OutreachLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OutreachLog" ADD CONSTRAINT "OutreachLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductType" ADD CONSTRAINT "ProductType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StageHistory" ADD CONSTRAINT "StageHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StageHistory" ADD CONSTRAINT "StageHistory_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "public"."Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StageHistory" ADD CONSTRAINT "StageHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

