ALTER TABLE "ButtonConfig" ADD COLUMN "googleAdsCustomerId" TEXT;
ALTER TABLE "ButtonConfig" ADD COLUMN "googleAdsRefreshToken" TEXT;

ALTER TABLE "Customer" ADD COLUMN "enrichment_status" TEXT;
ALTER TABLE "Customer" ADD COLUMN "enrichment_error" TEXT;
ALTER TABLE "Customer" ADD COLUMN "campaign_id" TEXT;
ALTER TABLE "Customer" ADD COLUMN "campaign_name" TEXT;
ALTER TABLE "Customer" ADD COLUMN "ad_group_id" TEXT;
ALTER TABLE "Customer" ADD COLUMN "ad_group_name" TEXT;
ALTER TABLE "Customer" ADD COLUMN "gclid_keyword" TEXT;
ALTER TABLE "Customer" ADD COLUMN "gclid_match_type" TEXT;
ALTER TABLE "Customer" ADD COLUMN "gclid_ad_id" TEXT;
ALTER TABLE "Customer" ADD COLUMN "gclid_click_date" TEXT;
ALTER TABLE "Customer" ADD COLUMN "gclid_ad_network_type" TEXT;
ALTER TABLE "Customer" ADD COLUMN "gclid_page_number" INTEGER;
ALTER TABLE "Customer" ADD COLUMN "gclid_geo_interest_country" TEXT;
ALTER TABLE "Customer" ADD COLUMN "gclid_geo_interest_region" TEXT;
ALTER TABLE "Customer" ADD COLUMN "gclid_geo_presence_country" TEXT;
ALTER TABLE "Customer" ADD COLUMN "gclid_geo_presence_region" TEXT;

CREATE INDEX "Customer_accountId_enrichment_status_idx" ON "Customer"("accountId", "enrichment_status");
