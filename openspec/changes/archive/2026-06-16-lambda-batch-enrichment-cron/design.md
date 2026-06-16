## Context

The Next.js app exposes `POST /api/lambda/enrich-batch` which enriches leads with Google Ads data for a given date. This endpoint is designed to be called externally — it authenticates via a shared secret and returns `202` immediately while running enrichment in the background. Currently no caller exists; enrichment only runs if triggered manually.

The Lambda lives outside the Next.js app (separate `lambda/` directory at repo root) and is purely a thin HTTP trigger — no database access, no business logic.

## Goals / Non-Goals

**Goals:**
- Automate enrichment for today's leads by calling the existing API twice daily
- Fail loudly (non-zero exit) on any error so CloudWatch Alarms can fire
- Keep the function minimal — zero business logic, zero DB access
- Ship with AWS SAM so infra is reproducible and version-controlled

**Non-Goals:**
- Retry logic inside the Lambda — the 23:59 UTC run already serves as a retry for the 12:00 run
- Multi-account or multi-date support — single date (today UTC) per invocation
- Changing or extending the batch enrichment API itself

## Decisions

### Runtime: Node.js 24.x with native `fetch`
Node.js aligns with the existing repo stack. Native `fetch` means zero runtime dependencies — the deployment artifact is a single `.mjs` file with no `node_modules`. Node 24 is the latest AWS Lambda managed runtime.

*Alternatives considered:* Python (familiar for Lambda, but adds context switch from JS team); `axios` (unnecessary dep when `fetch` works).

### Language: Plain ESM JavaScript (no TypeScript compile step)
The function is ~50 lines. A TypeScript build pipeline (tsc, bundler) adds friction for minimal gain. Raw `.mjs` keeps the deploy loop fast: edit → zip → upload.

*Alternatives considered:* TypeScript with esbuild (better for larger functions; overkill here).

### IaC: AWS SAM
SAM is Lambda-native, ships with the AWS CLI, and requires no extra toolchain. Defines Lambda + EventBridge schedules + IAM in `template.yaml`. Deployed via `sam build && sam deploy`.

*Alternatives considered:* Terraform (more general-purpose but heavier for Lambda-only infra); CDK (unnecessary complexity for this scope); manual console setup (not reproducible).

### Region: us-east-1
All AWS resources (Lambda, EventBridge rules, IAM execution role, CloudWatch log group) deployed to `us-east-1`.

### Directory layout
```
lambda/
  enrich-batch/
    handler.mjs       # Lambda handler
    handler.test.mjs  # Unit tests (fetch mocked)
  template.yaml       # SAM template (Lambda + EventBridge schedules + IAM)
  samconfig.toml      # SAM deploy defaults (stack name, region, params)
```

### Error strategy: throw on any non-2xx
Lambda marks invocations with uncaught errors as `ERROR` in CloudWatch. Throwing on non-2xx (401, 503, etc.) means CloudWatch Metric Filters / Alarms can alert without custom log parsing.

### UTC date derivation
```js
new Date().toISOString().split('T')[0]  // "2026-06-15"
```
`toISOString()` always returns UTC. No external library needed.

### Environment variables
| Variable | Where set | Purpose |
|---|---|---|
| `LAMBDA_API_SECRET` | SAM parameter → Lambda env | Bearer token for API auth |
| `BATCH_ENRICHMENT_API_URL` | SAM parameter → Lambda env | Base URL of deployed Next.js app |

Both are SAM template parameters passed at deploy time (`--parameter-overrides`). The Lambda handler exits before calling the API if either is missing. AWS credentials for deployment are supplied via the AWS CLI profile or environment (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`).

## Risks / Trade-offs

**[Leads created between 23:59 and midnight UTC won't be enriched same day]** → Acceptable window of ~1 minute. The 23:59 UTC run captures virtually all leads for the day. A backfill mechanism (manual invocation with a past date) exists via the API's `date` parameter for edge cases.

**[Lambda cold start delays the 202 response check]** → Not a concern — the API returns 202 immediately regardless of enrichment duration. Lambda only measures its own HTTP call latency, which is fast.

**[Secret rotation requires reapply]** → Mitigate by storing `LAMBDA_API_SECRET` in AWS SSM Parameter Store and referencing it via `{{resolve:ssm:/path/to/param}}` in `template.yaml`. Rotation updates SSM; `sam deploy` propagates the new value to the Lambda env.

**[No deduplication if both runs overlap]** → The API's eligibility filter (`enrichment_status != 'ENRICHED'`) is the dedup guard. If the 12:00 run finishes enriching a lead, the 23:59 run skips it.

## Migration Plan

1. Run `sam build` in `lambda/`
2. Run `sam deploy --guided` (first time — writes `samconfig.toml`); subsequent deploys: `sam deploy`
3. Verify EventBridge rules created and Lambda deployed in AWS Console (us-east-1)
4. Manually invoke Lambda (`aws lambda invoke --function-name enrich-batch-cron out.json`) and confirm `202 { "queued": N }` in CloudWatch Logs
5. Monitor CloudWatch Logs for first two scheduled runs (12:00 UTC and 23:59 UTC)

**Rollback:** `aws cloudformation delete-stack --stack-name <stack-name>` or disable both EventBridge rules. Lambda code changes redeploy via `sam build && sam deploy`.

