## 1. Database Schema

- [x] 1.1 Add enrichment fields to `Customer` model: `campaign_id`, `campaign_name`, `ad_group_id`, `ad_group_name`, `gclid_keyword`, `gclid_match_type`, `gclid_ad_id`, `gclid_click_date`, `gclid_ad_network_type`, `gclid_page_number`, `gclid_geo_interest_country`, `gclid_geo_interest_region`, `gclid_geo_presence_country`, `gclid_geo_presence_region`, `enrichment_status` (String, nullable), `enrichment_error` (String, nullable)
- [x] 1.2 Add Google Ads credential fields to `ButtonConfig` model: `googleAdsCustomerId` (String, nullable), `googleAdsRefreshToken` (String, nullable, stores AES-256-GCM ciphertext)
- [x] 1.3 Generate and run Prisma migration

## 2. Google Ads API Lib

- [x] 2.1 Create `src/lib/google-ads.ts` with `encryptToken(plaintext)` and `decryptToken(ciphertext)` using `crypto.createCipheriv('aes-256-gcm', ...)` keyed from `GOOGLE_ADS_TOKEN_ENCRYPTION_KEY` env var
- [x] 2.2 Implement `exchangeRefreshToken(refreshToken: string): Promise<string>` — POSTs to `https://oauth2.googleapis.com/token` with `grant_type=refresh_token`, `client_id`, `client_secret`, `refresh_token`; scope `https://www.googleapis.com/auth/adwords`; returns `access_token`
- [x] 2.3 Implement `queryClickView(customerId: string, accessToken: string, gclid: string)` — POSTs to `POST https://googleads.googleapis.com/v24/customers/{customerId}/googleAds:search` with headers `Authorization: Bearer {accessToken}`, `developer-token: {GOOGLE_ADS_DEVELOPER_TOKEN}`; GAQL selects from `click_view` filtered by `click_view.gclid = '{gclid}'` over `LAST_30_DAYS`; extracts: `campaign.id`, `campaign.name`, `ad_group.id`, `ad_group.name`, `click_view.keyword_info.text`, `click_view.keyword_info.match_type`, `click_view.ad_group_ad`, `click_view.page_number`, `click_view.area_of_interest.country`, `click_view.area_of_interest.region`, `click_view.location_of_presence.country`, `click_view.location_of_presence.region`, `segments.ad_network_type`, `segments.date`
- [x] 2.4 Implement `enrichLeadFromGclid(leadId: string, gclid: string, accountId: string): Promise<void>` — fetches `ButtonConfig` credentials, calls `exchangeRefreshToken` then `queryClickView`, updates `Customer` record with all extracted fields; sets `enrichment_status` to `ENRICHED`, `FAILED`, or `SKIPPED`; never throws (all errors caught internally and written to `enrichment_error`)

## 3. Conversion API — Enrichment Trigger

- [x] 3.1 In `src/app/api/conversion/route.ts`: set `enrichment_status: 'PENDING'` when creating a `Customer` with a non-null `gclid`
- [x] 3.2 After transaction resolves, call `after(() => enrichLeadFromGclid(customer.id, gclid, accountId))` from `next/server` when `gclid` is present

## 4. Manual Retry Endpoint

- [x] 4.1 Create `src/app/api/admin/leads/[id]/enrich/route.ts` with `POST` handler: requires admin session, rejects non-FAILED leads with 409, calls `await enrichLeadFromGclid(...)` synchronously, returns updated lead

## 5. Google Ads Config — Admin API

- [x] 5.1 ~~Update `parseButtonConfigInput` to accept `googleAdsCustomerId`~~ — superseded by 10.x; neither `googleAdsCustomerId` nor `googleAdsRefreshToken` come from the config form anymore
- [x] 5.2 In `src/app/api/admin/config/route.ts` PUT handler: remove `googleAdsCustomerId` from accepted fields (both ID and token set exclusively via OAuth + account-selection flow); strip `GOOGLE_ADS_DEVELOPER_TOKEN` from any response body
- [x] 5.3 In GET handler: return `googleAdsCustomerId` as-is; return `googleAdsRefreshToken` as a boolean (`hasRefreshToken: true/false`) — never return ciphertext or plaintext to client

## 6. Google Ads Config — Admin UI

- [x] 6.1 ~~`googleAdsCustomerId` text input~~ — superseded; config page shows connected account name/ID read-only; "Conectar Google Ads" button links to `/api/admin/google-ads/auth?accountId={id}`; "Desconectar" calls `POST /api/admin/google-ads/disconnect` (update in task 10.6)
- [x] 6.2 Show connection status badge: "Configurado" (green) when `hasGoogleAdsRefreshToken: true` AND `googleAdsCustomerId` present; "Não configurado" (grey) otherwise
- [x] 6.3 After OAuth redirect back with `?connected=1` query param, show a success toast/banner; after disconnect show "Não configurado"

## 8. OAuth2 Google Ads Connection

- [x] 8.1 Create `GET /api/admin/google-ads/auth/route.ts`: requires admin session; reads `accountId` from query; generates `nonce = randomUUID()`; sets httpOnly SameSite=Lax cookie `gads_oauth={accountId}:{nonce}` (max-age 300s); redirects to Google OAuth2 authorization URL with `response_type=code`, `scope=https://www.googleapis.com/auth/adwords`, `access_type=offline`, `prompt=consent`, `state={nonce}`, `redirect_uri={NEXTAUTH_URL}/api/admin/google-ads/callback`
- [x] 8.2 Update `GET /api/admin/google-ads/callback/route.ts`: after CSRF verification and token exchange, call `listAccessibleCustomers(accessToken)`; encrypt refresh token; store in `gads_select` cookie as `{configAccountId}:{encryptedRefreshToken}:{accountsJSON}` (max-age 600s); clear `gads_oauth` cookie; redirect to `/admin/google-ads/select-account?accountId={configAccountId}` — do NOT save to DB here
- [x] 8.3 Create `POST /api/admin/google-ads/disconnect/route.ts`: requires admin session; reads `accountId` from body; sets both `googleAdsRefreshToken = null` AND `googleAdsCustomerId = null` on `ButtonConfig`; returns updated config (with `hasGoogleAdsRefreshToken: false`)

## 10. Google Ads Account Picker

- [x] 10.1 Add `listAccessibleCustomers(accessToken: string): Promise<{id: string; name: string}[]>` to `src/lib/google-ads.ts` — calls `GET https://googleads.googleapis.com/v24/customers:listAccessibleCustomers` to get resource names, then for each ID queries `SELECT customer.id, customer.descriptive_name FROM customer` via `POST /v24/customers/{id}/googleAds:search`; returns `[{id, name}]`
- [x] 10.2 Create `GET /api/admin/google-ads/accounts/route.ts`: requires admin session; reads `gads_select` cookie; parses `{configAccountId}:{encryptedRefreshToken}:{accountsJSON}`; returns `{ configAccountId, accounts: [{id, name}] }`; returns 400 if cookie absent or malformed
- [x] 10.3 Create `POST /api/admin/google-ads/select-account/route.ts`: requires admin session; reads `gads_select` cookie; verifies `configAccountId` matches `accountId` in request body; saves `googleAdsCustomerId` (chosen ID) and `googleAdsRefreshToken` (encrypted, from cookie) to `ButtonConfig`; clears `gads_select` cookie; returns `{ ok: true }`
- [x] 10.4 Create `src/app/admin/google-ads/select-account/page.tsx`: client page; on mount fetches `GET /api/admin/google-ads/accounts`; renders list of accounts (name + ID); selected account highlighted; "Confirmar" button calls `POST /api/admin/google-ads/select-account`; on success redirects to `/admin/config?accountId={configAccountId}&connected=1`; on error shows message
- [x] 10.5 Update `src/app/admin/config/page.tsx`: remove customer ID text input; show selected account ID read-only when `googleAdsCustomerId` present in config GET response

## 7. Leads Page — Enrichment UI

- [x] 7.1 In `src/app/api/admin/leads/route.ts` GET handler: include `enrichment_status`, `enrichment_error`, `campaign_name`, `ad_group_name`, `gclid_keyword` in response
- [x] 7.2 In `src/app/admin/leads/page.tsx`: add enrichment status column — warning icon for `FAILED`, checkmark or label for `ENRICHED`, dash for `SKIPPED`/`PENDING`/`NULL`
- [x] 7.3 Add retry button on `FAILED` rows: calls `POST /api/admin/leads/[id]/enrich`, refreshes row on success
- [x] 7.4 Show `campaign_name`, `ad_group_name`, `gclid_keyword` columns (or in expandable row detail) for `ENRICHED` leads

## 9. Batch Retry — Leads Page

- [x] 9.1 In `src/app/admin/leads/page.tsx`: add `batchRetrying: boolean` and `batchProgress: { current: number; total: number } | null` state; add `handleBatchRetry()` — filters `filteredLeads` for `enrichment_status === 'FAILED'`, iterates sequentially with `await` between each `POST /api/admin/leads/[id]/enrich` call, updates each lead in state as it resolves, tracks progress
- [x] 9.2 Add "Reprocessar falhos" button in the leads page header area: disabled when no FAILED leads in current view; shows "Reprocessando N / M..." with progress while running; re-enables when complete
