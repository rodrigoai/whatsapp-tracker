## Context

Leads saved with a `gclid` get enriched asynchronously via `after()` at conversion time. When that enrichment fails (API delay, missing ClickView data) the lead sits with `enrichment_status = FAILED` or `PENDING`. An AWS Lambda function runs nightly (or on-demand) to retry all unenriched leads for a given date. The endpoint must protect itself without requiring an admin session, and must respond before Lambda's HTTP timeout.

## Goals / Non-Goals

**Goals:**
- Accept a date and enrich all eligible leads (gclid set, not ENRICHED) for that date
- Return quickly (202) — processing runs in background via `after()`
- Authenticate via shared secret so Lambda can call without admin credentials
- Reuse existing `enrichLeadFromGclid` — no new enrichment logic

**Non-Goals:**
- Streaming progress or polling endpoint for batch status
- Parallel enrichment (intentionally sequential to respect Google Ads API rate limits)
- Admin UI trigger for batch
- Multi-date ranges — caller invokes once per date

## Decisions

### 1. Background execution via `after()`

**Decision**: Fire enrichment inside Next.js `after()`, return 202 immediately.

**Why**: Lambda HTTP timeout is typically 30s. A batch of even 50 leads × ~1s per enrichment would exceed that. `after()` lets the response go out and continues processing server-side.

**Alternative considered**: Synchronous processing with chunked streaming — rejected: Lambda SDK doesn't easily consume streaming responses; adds complexity for no benefit since Lambda only needs a trigger, not a result.

### 2. Auth via `Authorization: Bearer <LAMBDA_API_SECRET>`

**Decision**: Validate `Authorization: Bearer <token>` against `LAMBDA_API_SECRET` env var. Return 401 if absent or mismatched.

**Why**: Lambda stores the secret as an env var and injects it into the HTTP request header. This is a standard machine-to-machine pattern. Admin session (cookie-based) is not usable from Lambda.

**Alternative considered**: IP allowlist (Lambda NAT Gateway IP) — rejected: fragile, changes with VPC config, requires infra coordination.

### 3. Endpoint under `/api/lambda/` namespace

**Decision**: `POST /api/lambda/enrich-batch` — not under `/api/admin/`.

**Why**: Admin routes use NextAuth session auth. Lambda routes use bearer token. Mixing them in the same namespace would require conditional auth logic. Separate namespace makes the contract clear.

### 4. Sequential enrichment within `after()`

**Decision**: `for...of` loop with `await enrichLeadFromGclid(...)` — one at a time.

**Why**: `enrichLeadFromGclid` calls Google Ads API sequentially per lead already. Parallel calls risk hitting Google Ads rate limits and flooding SQLite with concurrent writes. Sequential is safe and predictable.

### 5. Eligibility query

**Decision**: Query leads where `gclid IS NOT NULL AND enrichment_status != 'ENRICHED'` and `DATE(conversionTime) = <date>`.

**Why**: Covers FAILED, PENDING, NULL-with-gclid, and SKIPPED leads equally — all are retryable since credentials/API state may have changed. Excluding ENRICHED prevents redundant work.

## Risks / Trade-offs

- **`after()` duration**: Next.js `after()` runs until the work is done, but the serverless function must not be killed by the platform. On Vercel, `after()` respects max duration limits. If the batch is very large, it may be truncated. Mitigation: Lambda invokes per-date, batches are typically small (leads per day, not all-time).

- **No visibility into batch outcome**: Lambda fires and gets 202; it cannot know if enrichment succeeded. Mitigation: backoffice leads table shows per-lead status; Lambda logs can be monitored via CloudWatch.

- **Shared secret rotation**: Rotating `LAMBDA_API_SECRET` requires updating both Next.js env and Lambda env simultaneously. Mitigation: document in runbook; secret is short-lived in memory only.

- **SQLite concurrency**: Sequential enrichment reduces but does not eliminate concurrent writes if other background jobs run simultaneously. Mitigation: enrichments are row-level updates to separate Customer records — no write contention expected.
