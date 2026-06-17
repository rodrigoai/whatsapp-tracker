## Context

No external API exists for leads today. The only access path is the admin backoffice (`/api/admin/leads`), which requires a NextAuth session and is capped at 7 days. Third-party integrations need a machine-consumable, authenticated endpoint with no session dependency.

The `Customer` model in Prisma is the lead record. `Account` has no API key field. The `[accountId, conversionTime]` composite index already supports efficient date-filtered queries. `src/app/api/leads/summary/route.ts` occupies the `leads` namespace — a new `route.ts` at that level adds `GET /api/leads` without conflict.

## Goals / Non-Goals

**Goals:**
- Expose a public, API-key-authenticated `GET /api/leads` endpoint
- Support cursor-based pagination for reliable traversal of large datasets
- Support optional `from`/`to` date filters (UTC calendar dates, no timezone conversion)
- Support optional `status` filter(s) server-side, with `null` DB value mapping to `Not Qualified`

**Non-Goals:**
- Mutation of lead data (create/update/delete)
- Bulk export beyond paginated traversal
- Multiple API keys per account or key rotation UI (can be added later)
- Removing or altering the 7-day cap on the existing admin route

## Decisions

### Auth: reuse existing `API_SECRET` env var
The codebase already has a shared secret pattern used by `/api/leads/summary` and `/api/lambda/enrich-batch`: `API_SECRET` env var verified via `timingSafeEqual` against the `Authorization: Bearer <token>` header. The new endpoint uses the same `checkAuth` helper (extract to shared lib or duplicate the guard — same pattern).

No schema change needed for auth. No per-account key — the secret is global to the deployment.

_Alternatives considered:_ per-account `apiKey` on `Account` model — more granular but requires a migration and UI for key management; premature given current integration needs.

### Pagination: cursor-based on (conversionTime DESC, id DESC)
Offset pagination skips or duplicates rows when new leads arrive mid-traversal. Cursor uses `conversionTime + id` as a stable compound cursor — `id` is the tiebreaker when two leads share the same timestamp.

Cursor is opaque to the caller (base64-encoded JSON `{ conversionTime, id }`). Response includes `nextCursor: string | null`.

Default `pageSize` is 50; max is 200 (enforced server-side).

_Alternatives considered:_ offset/page — simpler client code but unreliable on live data.

### Status filter: server-side OR query, null = Not Qualified
`status` is `String?` in DB. `null` represents "Not Qualified". When caller passes `status=Not Qualified`, query adds `status: null` to the OR list alongside any explicit values. Multiple values accepted as repeated query params (`?status=Proposta&status=Venda`).

### Date filter: UTC calendar dates, no timezone conversion, no day cap
`from` and `to` are pure calendar dates (`YYYY-MM-DD`). The API interprets them as UTC day boundaries — `from` = `T00:00:00.000Z`, `to` = `T23:59:59.999Z`. No timezone conversion is applied, so behaviour is identical regardless of the caller's locale. The public API does not impose the 7-day cap (external integrations may need full history).

The `parseDateOnly` helper in `src/lib/date-utils.ts` applies BRT offset and is kept for the admin backoffice only. The public route builds UTC dates directly.

### Response shape
```json
{
  "data": [ /* Customer fields + Google Ads enrichment fields */ ],
  "pagination": {
    "next_cursor": "<opaque string | null>",
    "has_more": true,
    "page_size": 50
  }
}
```

Each lead object returns all consumer-relevant fields plus the full Google Ads enrichment data so third-party systems can correlate leads to campaigns without a separate enrichment step:

Each lead object is shaped as:

```json
{
  "id": "...",
  "name": "...",
  "email": "...",
  "phone": "...",
  "status": "...",
  "conversion_time": "...",
  "conversion_name": "...",
  "value": 0.0,
  "currency": "BRL",
  "utm_source": "...",
  "utm_campaign": "...",
  "utm_medium": "...",
  "enrichment_status": "ENRICHED",
  "google_ads": {
    "gclid": "...",
    "gbraid": "...",
    "wbraid": "...",
    "campaign_id": "...",
    "campaign_name": "...",
    "ad_group_id": "...",
    "ad_group_name": "...",
    "gclid_keyword": "...",
    "gclid_match_type": "...",
    "gclid_ad_id": "...",
    "gclid_click_date": "...",
    "gclid_ad_network_type": "...",
    "gclid_page_number": null,
    "gclid_geo_interest_country": "...",
    "gclid_geo_interest_region": "...",
    "gclid_geo_presence_country": "...",
    "gclid_geo_presence_region": "..."
  }
}
```

Google click IDs (`gclid`, `gbraid`, `wbraid`) and campaign enrichment fields are nested under `google_ads`. `enrichment_status` is top-level — it describes the enrichment pipeline state and will be reused for future providers (e.g. Meta). `enrichment_error` is excluded (internal diagnostic). UTM params stay top-level as they are source-agnostic.

## Risks / Trade-offs

- **Shared secret = no per-account isolation** → any caller with `API_SECRET` can query any account's leads. Acceptable given the secret is operator-controlled; per-account keys can be layered later if multi-tenant isolation is needed.
- **Cursor stability across schema changes** → cursor encodes `conversionTime` (ISO string) + `id`. If `id` generation changes (unlikely with cuid), old cursors break. Acceptable.
- **`pageSize` max of 200** → limits per-request DB load. Callers needing full history must paginate.

## Migration Plan

1. Ensure `API_SECRET` is set in the deployment environment (already required by existing routes)
2. Deploy new `GET /api/leads` route

Rollback: remove the route file. No schema or env changes required.
