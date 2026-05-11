-- NOTE: ProductCategory and LeadSource were already created in a prior partial
-- application of this migration. They are intentionally omitted here.

-- AlterEnum: replace old JobType values with new ones.
-- Opportunity.jobType exists and is nullable (all values are NULL — cast is safe).
-- Lead.jobType does not exist yet; it is added below after the rename completes.
CREATE TYPE "JobType_new" AS ENUM ('NEW_CONSTRUCTION', 'MAC', 'INSTALL', 'BOX_SALE', 'UPGRADE_REFRESH', 'RFP_BID', 'SERVICE_ON_DEMAND', 'SERVICE_CONTRACTED');
ALTER TABLE "Opportunity" ALTER COLUMN "jobType" TYPE "JobType_new" USING ("jobType"::text::"JobType_new");
ALTER TYPE "JobType" RENAME TO "JobType_old";
ALTER TYPE "JobType_new" RENAME TO "JobType";
DROP TYPE "JobType_old";

-- AlterTable: Customer
ALTER TABLE "Customer"
ADD COLUMN "hqAddress" TEXT,
ADD COLUMN "hqCity"    TEXT,
ADD COLUMN "hqState"   TEXT,
ADD COLUMN "hqZip"     TEXT,
ADD COLUMN "hqLat"     DOUBLE PRECISION,
ADD COLUMN "hqLng"     DOUBLE PRECISION,
ADD COLUMN "zip"       TEXT;

-- AlterTable: Lead
ALTER TABLE "Lead"
ADD COLUMN "jobType"         "JobType",
ADD COLUMN "leadSource"      "LeadSource",
ADD COLUMN "productCategory" "ProductCategory",
ADD COLUMN "zip"             TEXT;

-- AlterTable: Opportunity
ALTER TABLE "Opportunity"
ADD COLUMN "jobSiteAddress"  TEXT,
ADD COLUMN "jobSiteCity"     TEXT,
ADD COLUMN "jobSiteState"    TEXT,
ADD COLUMN "jobSiteZip"      TEXT,
ADD COLUMN "jobSiteLat"      DOUBLE PRECISION,
ADD COLUMN "jobSiteLng"      DOUBLE PRECISION,
ADD COLUMN "leadSource"      "LeadSource",
ADD COLUMN "productCategory" "ProductCategory";

-- CreateTable
CREATE TABLE "CustomerLocation" (
    "id"         TEXT         NOT NULL,
    "tenantId"   TEXT         NOT NULL,
    "customerId" TEXT         NOT NULL,
    "name"       TEXT         NOT NULL,
    "address"    TEXT,
    "city"       TEXT,
    "state"      TEXT,
    "zip"        TEXT,
    "lat"        DOUBLE PRECISION,
    "lng"        DOUBLE PRECISION,
    "isHQ"       BOOLEAN      NOT NULL DEFAULT false,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerLocation_tenantId_idx"   ON "CustomerLocation"("tenantId");
CREATE INDEX "CustomerLocation_customerId_idx" ON "CustomerLocation"("customerId");

-- AddForeignKey
ALTER TABLE "CustomerLocation" ADD CONSTRAINT "CustomerLocation_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerLocation" ADD CONSTRAINT "CustomerLocation_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
