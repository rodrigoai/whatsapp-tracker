## Why

Third-party systems (CRMs, analytics tools, marketing platforms) need programmatic access to leads captured per account. No external API exists today — the only access is through the backoffice UI, which is admin-only and not machine-consumable.

## What Changes

- New paginated REST endpoint: `GET /api/leads?accountId=<id>&page=<n>&pageSize=<n>`
- Optional `from` / `to` date filters (`YYYY-MM-DD`, America/Sao_Paulo timezone, inclusive) to narrow by `conversionTime`
- Optional `status` filter (repeatable or comma-separated): accepted values are `Not Qualified`, `Proposta`, `Venda`; `Not Qualified` matches leads where DB `status` is null
- Endpoint is public-facing (no NextAuth session required) but secured via API key per account
- Returns leads in reverse-chronological order with pagination metadata

## Capabilities

### New Capabilities
- `lead-listing`: Paginated lead listing endpoint scoped to an account, authenticated via API key, returning lead records with pagination envelope

### Modified Capabilities

## Impact

- New API route: `src/app/api/leads/route.ts`
- Prisma queries on `Customer` model filtered by `accountId`
- Auth via existing `API_SECRET` env var (same pattern as `/api/leads/summary`)
- No schema migrations required
- No changes to existing `/api/conversion`, `/api/script.js`, or `/api/leads/summary` routes
