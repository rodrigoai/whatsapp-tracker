## Why

Leads registered each day need GCLID enrichment from Google Ads, but the existing `POST /api/lambda/enrich-batch` endpoint must be triggered externally — no automation exists. An AWS Lambda on a cron schedule will fire twice daily to ensure leads captured throughout the day are enriched without manual intervention.

## What Changes

- New standalone AWS Lambda function (Node.js) that calls `POST /api/lambda/enrich-batch` with today's date
- Lambda is invoked by EventBridge (CloudWatch Events) cron, twice a day (e.g. 12:00 UTC and 23:00 UTC)
- Lambda authenticates via `Authorization: Bearer <LAMBDA_API_SECRET>` header
- Lambda logs response (queued count, errors) to CloudWatch
- Deployment config (IaC or deployment instructions) included alongside function code

## Capabilities

### New Capabilities
- `batch-enrichment-lambda`: AWS Lambda function code and config that triggers the batch enrichment API on a cron schedule twice daily

### Modified Capabilities
<!-- No existing spec-level requirements change — the API contract in batch-lead-enrichment/spec.md stays intact -->

## Impact

- **New code**: Lambda function source (outside Next.js app, likely `lambda/` directory)
- **Existing API**: `POST /api/lambda/enrich-batch` — consumed as-is, no changes
- **Env vars**: `LAMBDA_API_SECRET` (already required by API), `BATCH_ENRICHMENT_API_URL` (base URL of deployed Next.js app)
- **AWS**: Lambda function + EventBridge cron rules (2 schedules)
- **No database changes**
