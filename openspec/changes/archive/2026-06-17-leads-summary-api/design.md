## Context

`Customer` records accumulate via `/api/conversion` and get enriched with Google Ads campaign data asynchronously. The `status` field is updated to `"Proposta"` or `"Venda"` via spreadsheet import (`/api/admin/import-results`). No endpoint currently aggregates this data. External marketing platforms need funnel metrics grouped by source and campaign to correlate ad spend with sales outcomes.

Both `accountId` and date range (`from` / `to`) are required on every request.

## Goals / Non-Goals

**Goals:**
- `GET /api/leads/summary?accountId=&from=&to=` returns funnel groups `{ source, campaignId, campaign, leads, proposals, sales }`
- Source: `Google` (gclid present) | `Organic` (fallback); extensible for `Meta`
- Campaign label: `campaign_name` → `utm_campaign` → `"(sem campanha)"`
- Auth: global Bearer token from env var `API_SECRET`
- All three params required; return 400 otherwise
- No Prisma schema changes

**Non-Goals:**
- Meta / other origins (architecture supports it; not implemented now)
- Token rotation UI or per-account token management
- Revenue/value aggregation
- Pagination (bounded by required date range)

## Decisions

### Rename `LAMBDA_API_SECRET` → `API_SECRET`

`LAMBDA_API_SECRET` is a misnomer — the secret is not Lambda-specific, it's a general M2M token. Rename to `API_SECRET` and use it in both `/api/lambda/enrich-batch` (updated) and the new `/api/leads/summary`. Same pattern: `Authorization: Bearer <token>` + `crypto.timingSafeEqual`.

**Why:** One generic secret for all machine-to-machine endpoints. Consistent naming. Rotation covers all M2M callers simultaneously.

**Migration:** Rename env var in all environments before deploying. `enrich-batch` and the Lambda caller both need the rename applied atomically.

### Raw SQL aggregation via `prisma.$queryRaw`

Prisma's `groupBy` cannot express computed columns (`CASE WHEN gclid IS NOT NULL`). Lead volumes may be large, so in-memory reduction is not acceptable.

**Decision:** Single `prisma.$queryRaw` aggregation query:

```sql
SELECT
  CASE WHEN gclid IS NOT NULL THEN 'Google' ELSE 'Organic' END AS source,
  campaign_id                                                    AS "campaignId",
  COALESCE(campaign_name, utm_campaign, '(sem campanha)')        AS "campaign",
  COUNT(*)                                                       AS leads,
  SUM(CASE WHEN status = 'Proposta' THEN 1 ELSE 0 END)          AS proposals,
  SUM(CASE WHEN status = 'Venda'    THEN 1 ELSE 0 END)          AS sales
FROM "Customer"
WHERE "accountId" = $1
  AND "conversionTime" >= $2
  AND "conversionTime" <= $3
GROUP BY source, "campaignId", "campaign"
ORDER BY source ASC, "campaign" ASC
```

Tests mock `prisma.$queryRaw` — still a Prisma call, satisfies the no-real-DB rule.

### Route location: `/api/leads/summary` (not `/api/admin/...`)

Admin routes are protected by NextAuth session. This endpoint uses a different auth mechanism and is consumed by third parties, so it lives outside the `/api/admin/` namespace.

### Required params — return 400, not default range

No unbounded queries. Missing `accountId`, `from`, or `to` → `400 Bad Request` with a descriptive error. No defaulting to "last 30 days" or similar.

### Response shape

```json
{
  "groups": [
    { "source": "Google", "campaignId": "123456", "campaign": "Campanha X", "leads": 50, "proposals": 10, "sales": 3 },
    { "source": "Organic", "campaignId": null, "campaign": "(sem campanha)", "leads": 12, "proposals": 2, "sales": 1 }
  ]
}
```

`campaignId` is from the Google Ads enrichment field `campaign_id`; null for unenriched or Organic leads. Sorted: source alpha, then `campaign` alpha. Deterministic order simplifies consumer diffing.

## Risks / Trade-offs

- **Shared `API_SECRET` across endpoints** → rotating it requires coordinating the enrichment Lambda caller and the marketing integration simultaneously. Acceptable; both are controlled consumers.
- **Un-enriched Google leads** → `campaign_name` is null until enrichment Lambda runs; these appear as `{ source: "Google", campaign: "(sem campanha)" }`. Consumers must account for enrichment lag.
- **Status coupling** → funnel stages depend on Portuguese string literals `"Proposta"` / `"Venda"` defined in `src/lib/validation.ts`. Renaming either is a breaking change across import + summary. Document and freeze these values.
- **`from` / `to` are inclusive UTC boundaries** → `conversionTime >= new Date(from)` and `<= end of day(to)`. Clarify in spec to avoid off-by-one at consumer side.
