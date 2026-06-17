## Why

External marketing platforms (Google Ads, Meta, etc.) need a unified view of lead conversion funnel data grouped by traffic origin and campaign, but the system currently has no aggregation endpoint — only raw lead records. Adding a summary API allows third-party integrations to correlate ad spend with actual sales outcomes without building that aggregation themselves.

## What Changes

- New API endpoint `GET /api/leads/summary` scoped to an account
- Returns leads grouped by origin (`Google`, `Organic`; `Meta` reserved for future) and campaign
- Each group exposes three funnel stages: total leads, leads with sale proposal (`status = "Proposta"`), confirmed sales (`status = "Venda"`)
- `accountId`, `from`, and `to` query params are all **required**
- Token-based authentication (API key) — designed for third-party consumption, not admin session

## Capabilities

### New Capabilities

- `leads-summary`: Aggregate endpoint that groups `Customer` records by traffic origin and campaign, returning sales funnel counts (total, proposals, sales) per group. Origin is derived from `gclid` presence (Google) or absence (Organic); campaign from `campaign_name` (enriched) falling back to `utm_campaign`. Authenticated via a global Bearer token configured as an environment variable.

### Modified Capabilities

_(none)_

## Impact

- **New file**: `src/app/api/leads/summary/route.ts`
- **Prisma**: No schema changes — query existing `Customer` model only
- **Config**: Renames `LAMBDA_API_SECRET` → `API_SECRET` (generic M2M token); updates `/api/lambda/enrich-batch` to use new name
- **Auth**: Global Bearer token independent of NextAuth; no admin UI needed
- **Consumers**: External marketing integration systems; no existing internal UI affected
