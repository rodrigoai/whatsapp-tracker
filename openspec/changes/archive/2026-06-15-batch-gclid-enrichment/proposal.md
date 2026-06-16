## Why

Leads captured when the Google Ads API is slow or unavailable end up with `enrichment_status = FAILED` or `PENDING`. A scheduled AWS Lambda function needs to re-process all unenriched leads for a given day in bulk, without requiring manual per-row retries in the backoffice.

## What Changes

- New API endpoint `POST /api/lambda/enrich-batch` that accepts a `date` parameter and enriches all eligible leads for that date
- Eligible leads: `gclid IS NOT NULL` AND `enrichment_status != ENRICHED`
- Enrichment runs one lead at a time (sequential, not parallel) to avoid overwhelming the database
- Endpoint fires enrichment via `after()` and returns `202 Accepted` immediately so the Lambda function does not timeout waiting for batch completion
- Endpoint protected by a shared secret (`LAMBDA_API_SECRET` env var) validated via `Authorization: Bearer <secret>` header — no admin session required

## Capabilities

### New Capabilities
- `batch-lead-enrichment`: Protected endpoint for Lambda-triggered batch enrichment of unenriched leads for a given date, returning immediately while processing runs in background

### Modified Capabilities

## Impact

- New API route: `src/app/api/lambda/enrich-batch/route.ts`
- Reuses existing `enrichLeadFromGclid` function from the GCLID enrichment lib
- New env var: `LAMBDA_API_SECRET`
- No schema changes — uses existing `enrichment_status` field and `Customer` model
- No UI changes
