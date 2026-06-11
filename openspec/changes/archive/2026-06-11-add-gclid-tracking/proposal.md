## Why

When leads arrive via Google Ads without UTM tags on the destination URL, the system stores the `gclid` but has no campaign attribution — marketers cannot tie conversions back to specific campaigns, ad groups, or keywords. The Google Ads API can resolve a `gclid` to its full campaign context, closing this attribution gap.

## What Changes

- New async enrichment step: after a lead is saved with a `gclid`, fire a non-blocking async call (no background jobs) to query the Google Ads API and back-fill campaign details onto the `Customer` record. Enrichment is best-effort — any failure must never abort or roll back lead registration. An incomplete lead with `enrichment_status=FAILED` is always preferable to no lead.
- New fields on `Customer` model: store Google Ads-resolved data (`campaign_id`, `campaign_name`, `ad_group_id`, `ad_group_name`, `keyword`, `match_type`, `ad_id`, `enrichment_status`, `enrichment_error`).
- New per-account Google Ads connection via OAuth2 authorization code flow: admin clicks "Conectar Google Ads" on the config page, authorizes via Google consent screen, and the refresh token is stored encrypted on `ButtonConfig`. No manual token pasting. Admin can also disconnect at any time.
- Backoffice leads view updated to surface enriched campaign data alongside existing UTM fields.
- Enrichment marked as `PENDING → ENRICHED | FAILED | SKIPPED` so operators can see which leads were resolved.
- Manual retry: operators can re-trigger enrichment for a `FAILED` lead directly from the backoffice leads page.

## Capabilities

### New Capabilities

- `gclid-campaign-enrichment`: Queries the Google Ads API with a `gclid` to resolve campaign, ad group, keyword, and match-type details, then persists those fields on the `Customer` record. Includes status tracking (`PENDING`, `ENRICHED`, `FAILED`, `SKIPPED`), error capture, and manual retry for `FAILED` leads triggered from the backoffice.
- `google-ads-account-config`: Per-account Google Ads connection via OAuth2 authorization code flow. Admin connects their Google account through a standard OAuth consent screen; the refresh token is stored AES-256-GCM encrypted. Includes connect, reconnect, and disconnect flows. Needed before enrichment can run.

### Modified Capabilities

_(none — no existing specs)_

## Impact

- **`prisma/schema.prisma`**: New fields on `Customer`; new model or fields on `ButtonConfig` for Google Ads credentials.
- **`src/app/api/conversion/route.ts`**: After saving the lead, fire a non-blocking `enrichLeadFromGclid(customerId, gclid)` call (no `await`, no job queue) when `gclid` is present and credentials are configured. Lead response is returned immediately; enrichment runs independently and never affects the conversion outcome.
- **`src/app/admin/leads/page.tsx`** + **`src/app/api/admin/leads/route.ts`**: Display enriched campaign columns; expose enrichment status; retry button for `FAILED` leads.
- **New**: `src/app/api/admin/leads/[id]/enrich/route.ts` — POST endpoint to manually re-trigger enrichment for a single lead.
- **`src/app/admin/config/page.tsx`** + **`src/app/api/admin/config/route.ts`**: Config page shows Google Ads connection status; customer ID input; connect/reconnect/disconnect buttons.
- **New**: `src/app/api/admin/google-ads/auth/route.ts` — initiates OAuth2 authorization code flow with CSRF state cookie.
- **New**: `src/app/api/admin/google-ads/callback/route.ts` — receives OAuth2 callback, verifies state, exchanges code for tokens, stores encrypted refresh token.
- **New**: `src/app/api/admin/google-ads/disconnect/route.ts` — clears refresh token from `ButtonConfig`.
- **New lib**: `src/lib/google-ads.ts` — AES-256-GCM encryption, OAuth2 token exchange, ClickView query (Google Ads API v24), `enrichLeadFromGclid`.
- **Env vars**: `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_TOKEN_ENCRYPTION_KEY`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `NEXTAUTH_URL`.
