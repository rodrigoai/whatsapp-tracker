## Context

The conversion API already stores `gclid` on the `Customer` record, but without UTM tags the campaign, ad group, and keyword context is missing. The Google Ads API `ClickView` resource can resolve a `gclid` to full campaign details. Enrichment must never block or fail lead registration.

The app runs on Vercel (serverless). Serverless functions terminate as soon as the response is sent — a bare `void promise` will be silently abandoned mid-execution. Enrichment must be scheduled via Next.js `after()` to run reliably after the response flushes.

## Goals / Non-Goals

**Goals:**
- After a lead with a `gclid` is saved, asynchronously query Google Ads API and write campaign details back to the `Customer` record.
- Store per-account Google Ads credentials (customer ID + OAuth2 refresh token) alongside existing `ButtonConfig`.
- Surface enrichment status and resolved fields in the admin leads view.
- Never abort or roll back lead registration on enrichment failure.

**Non-Goals:**
- Automatic retry (no job queue, no scheduler) — retries are manual-only.
- Enriching leads without a `gclid` (UTM-only leads are already attributed).
- Real-time enrichment guarantees — Google Ads ClickView data has a processing delay of up to a few hours; a first attempt may legitimately return no results.

## Decisions

### 1. Plain HTTP fetch over `google-ads-api` npm package

The Google Ads REST API (`https://googleads.googleapis.com/v{version}/customers/{cid}/googleAds:search`) is accessible with standard `fetch`. Adding `google-ads-api` (a heavy gRPC-based package) would increase bundle size and add a complex transitive dependency tree.

**Chosen:** Raw `fetch` calls to `https://googleads.googleapis.com/v24/customers/{cid}/googleAds:search` (v24 — latest stable as of 2026-05-13), with a thin `src/lib/google-ads.ts` wrapper. Token exchange via `https://oauth2.googleapis.com/token`.

**Alternative rejected:** `google-ads-api` npm — unnecessary weight for a single-query use case.

### 2. Credentials stored on `ButtonConfig`

Each `Account` already has a one-to-one `ButtonConfig`. Adding `googleAdsCustomerId` (plain string, set via account picker) and `googleAdsRefreshToken` (encrypted, set via OAuth callback) to `ButtonConfig` avoids a new model and keeps per-account config in one place.

`GOOGLE_ADS_DEVELOPER_TOKEN` is global — stored as an env var, not per-account.

**Chosen:** New nullable fields on `ButtonConfig`.

**Alternative rejected:** Separate `GoogleAdsConfig` model — unnecessary indirection for fields that map 1:1 to an account.

### 3. OAuth2 authorization code flow for token acquisition

Admins must not paste raw refresh tokens into a form — it is error-prone and a security anti-pattern (tokens in browser history, logs, etc.). Instead, the admin connects their Google account via a standard OAuth2 authorization code flow triggered from the config page. After OAuth completes, the system fetches all accessible Google Ads accounts and presents a picker — the admin selects one rather than typing a customer ID.

```
Config page
  └─ "Conectar Google Ads" button
       └─ GET /api/admin/google-ads/auth?accountId={configAccountId}   (admin session required)
            ├─ generate nonce = randomUUID()
            ├─ set httpOnly SameSite=Lax cookie: gads_oauth={configAccountId}:{nonce}  (5 min TTL)
            └─ redirect → https://accounts.google.com/o/oauth2/v2/auth
                  ?response_type=code
                  &scope=https://www.googleapis.com/auth/adwords
                  &access_type=offline
                  &prompt=consent
                  &state={nonce}
                  &redirect_uri={origin}/api/admin/google-ads/callback

GET /api/admin/google-ads/callback?code=...&state=...
  ├─ read cookie gads_oauth → extract configAccountId + stored nonce
  ├─ verify state === stored nonce  (CSRF check)
  ├─ clear gads_oauth cookie
  ├─ POST https://oauth2.googleapis.com/token  (exchange code → access+refresh tokens)
  ├─ call listAccessibleCustomers(accessToken) → [{id, name}, ...]
  ├─ encrypt refresh token with AES-256-GCM
  ├─ set httpOnly SameSite=Lax cookie: gads_select={configAccountId}:{encryptedRefreshToken}:{accounts JSON}  (10 min TTL)
  └─ redirect → /admin/google-ads/select-account?accountId={configAccountId}

/admin/google-ads/select-account (client page)
  └─ GET /api/admin/google-ads/accounts  (reads gads_select cookie → returns account list)
       └─ renders list of accessible accounts with name + ID
  └─ admin picks one → POST /api/admin/google-ads/select-account { adsCustomerId }
       ├─ read gads_select cookie → verify configAccountId
       ├─ prisma.buttonConfig.update({ googleAdsCustomerId, googleAdsRefreshToken: encrypted })
       ├─ clear gads_select cookie
       └─ return { ok: true } → client redirects to /admin/config?accountId={id}&connected=1
```

The config form does NOT accept `googleAdsCustomerId` or `googleAdsRefreshToken`. Both are set exclusively via the OAuth + account-selection flow.

**Chosen:** Authorization code flow with CSRF-protected state cookie + server-side account picker.

**Alternative rejected:** Manual customer ID text input — requires admins to know their numeric Google Ads CID; error-prone.
**Alternative rejected:** Manual refresh token paste — leaks tokens into browser history/logs.

### 3a. OAuth2 refresh token encrypted at rest (AES-256-GCM)

Refresh tokens are long-lived credentials. Storing them in plaintext in the DB is a security risk if the DB is ever exposed.

**Chosen:** Encrypt with `crypto.createCipheriv('aes-256-gcm', ...)` using a key derived from `GOOGLE_ADS_TOKEN_ENCRYPTION_KEY` env var. Decrypt only inside `src/lib/google-ads.ts` at call time.

### 4. Enrichment via `after()` from `next/server`

Vercel terminates serverless functions when the response is sent. `void promise` is unreliable — the work is abandoned. Next.js `after()` (stable since Next.js 15, available in 16.2.4) explicitly extends the function lifetime until the scheduled callback completes, and integrates with Vercel's infrastructure automatically.

Lead save happens inside a Prisma transaction. After the transaction resolves, `after()` schedules enrichment. The response is returned to the client immediately; enrichment runs in the extended lifetime window.

```
POST /api/conversion
  └─ prisma.$transaction → save Customer (enrichment_status=PENDING)
  └─ after(() => enrichLeadFromGclid(...))   ← scheduled post-response
  └─ return 200 to client
       enrichLeadFromGclid runs after response flushes:
        ├─ fetch credentials from ButtonConfig
        ├─ if no credentials → update status=SKIPPED, return
        ├─ call Google Ads API
        ├─ on results returned → update Customer with campaign fields + status=ENRICHED
        ├─ on empty results (data not yet processed) → status=FAILED, retryable
        └─ on API/auth error → status=FAILED, error saved, retryable
```

**Chosen:** `after()` from `next/server` — no new dependency, idiomatic for Vercel + Next.js.

**Alternative rejected:** `void promise` — silently abandoned on serverless; data loss.

### 5. ClickView query scope: single-day loop from conversion date

Google Ads ClickView only accepts a single-day date filter (`segments.date = 'YYYY-MM-DD'`); range predicates like `DURING LAST_30_DAYS` are rejected with `EXPECTED_FILTER_ON_A_SINGLE_DAY`. The click date is not known in advance, so enrichment queries one day at a time starting from the lead's `conversionTime` and stepping backward up to `gclidExpirationDays` days (capped at 90). The loop breaks on the first non-empty result. In the common case (same-day click → conversion) a single API call suffices.

**Fields extracted from ClickView (v24):**
- `campaign.id`, `campaign.name`
- `ad_group.id`, `ad_group.name`
- `click_view.keyword_info.text`, `click_view.keyword_info.match_type`
- `click_view.ad_group_ad` (ad resource name → ad ID)
- `click_view.page_number` (position on search results page)
- `click_view.area_of_interest.country`, `click_view.area_of_interest.region` (geographic intent)
- `click_view.location_of_presence.country`, `click_view.location_of_presence.region` (physical location)
- `segments.ad_network_type` (SEARCH, SEARCH_PARTNERS, CONTENT, etc.)
- `segments.date`

### 6. `enrichment_status` as string enum on `Customer`

Values: `PENDING` | `ENRICHED` | `FAILED` | `SKIPPED`

- `PENDING`: gclid present, enrichment not yet attempted (set at lead creation).
- `ENRICHED`: Google Ads API returned data, fields written.
- `FAILED`: API error, auth failure, or empty ClickView response (data not yet processed by Google). In all cases the lead record is preserved and the operator can manually retry. An empty API response MUST NOT be treated as `ENRICHED`.
- `SKIPPED`: No Google Ads credentials configured for the account.
- `NULL` (default): No gclid — enrichment not applicable. Exception: leads registered before this feature was deployed may have a `gclid` but `NULL` enrichment status. These are treated as retryable via the manual trigger (same endpoint as FAILED retry).

## Risks / Trade-offs

**ClickView API delay** → Leads enriched within seconds of click may return an empty result set (data not yet processed by Google). Status is set to `FAILED` — the lead is preserved and the warning icon in the leads table prompts the operator to retry manually once Google has processed the data (typically within a few hours).

**OAuth token revocation** → Refresh tokens can be revoked by the Google account owner (e.g. removing app access). If revoked, all subsequent enrichments will `FAILED` until the admin re-connects via the OAuth flow. The `FAILED` warning icon in the leads table is the signal to re-connect.

**AES key rotation** → If `GOOGLE_ADS_TOKEN_ENCRYPTION_KEY` changes, existing encrypted tokens in the DB become unreadable. Requires re-entering credentials for all accounts. Document this operational constraint.

**Manual retry (single)** → Per-row retry button calls `POST /api/admin/leads/[id]/enrich`. `FAILED` leads show a warning icon + retry button. Leads with `NULL` status and a `gclid` (pre-feature leads) show a plain trigger button. `ENRICHED` and `SKIPPED` show no button.

**Batch retry (all FAILED in view)** → A "Reprocessar falhos" button in the leads page header iterates sequentially through all `FAILED` leads currently visible (respecting the active date-range and search filters). Each lead is retried via the same `POST /api/admin/leads/[id]/enrich` endpoint, one at a time with `await` between calls, to avoid DB/API overload. Progress is shown inline (e.g. "3 / 7"). The batch operates only on the current view — not all leads in the account — keeping scope bounded and predictable.

## Migration Plan

1. Add new nullable fields to `Customer` and `ButtonConfig` via Prisma migration (all nullable — no backfill needed, no downtime).
2. Deploy new `src/lib/google-ads.ts` and updated conversion route.
3. Operators add Google Ads credentials via updated config page per account.
4. Historical leads with gclid remain `NULL` enrichment_status — considered out of scope for retroactive enrichment.

## Resolved Decisions

- **`FAILED` leads**: Show warning icon in leads table to prompt operator action. Retry button available on `FAILED` rows only.
- **Credentials model**: One global `GOOGLE_ADS_DEVELOPER_TOKEN` env var shared across all accounts. Per-account `googleAdsCustomerId` + encrypted `googleAdsRefreshToken` stored on `ButtonConfig`.
