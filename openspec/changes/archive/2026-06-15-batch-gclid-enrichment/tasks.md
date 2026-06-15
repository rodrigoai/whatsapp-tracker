## 1. Route Setup

- [x] 1.1 Create `src/app/api/lambda/enrich-batch/route.ts` with `POST` export
- [x] 1.2 Add `LAMBDA_API_SECRET` to `.env.example` with placeholder value

## 2. Auth Guard

- [x] 2.1 Return 503 if `LAMBDA_API_SECRET` env var is not set
- [x] 2.2 Extract `Authorization` header; return 401 if missing or not `Bearer <token>`
- [x] 2.3 Compare token to `LAMBDA_API_SECRET` using constant-time comparison; return 401 on mismatch

## 3. Request Validation

- [x] 3.1 Parse JSON body and extract `date` field; return 400 if absent
- [x] 3.2 Validate `date` matches `YYYY-MM-DD` format and is a valid calendar date; return 400 if invalid

## 4. Eligibility Query

- [x] 4.1 Query `Customer` records where `gclid IS NOT NULL`, `enrichment_status != 'ENRICHED'`, and `conversionTime` falls on the requested UTC date (use `gte`/`lt` for start-of-day and end-of-day bounds)

## 5. Background Batch Execution

- [x] 5.1 If eligible leads count is 0, return `202 { "queued": 0 }` immediately (no `after()` call)
- [x] 5.2 Register `after()` callback that iterates eligible leads with `for...of`, calling `await enrichLeadFromGclid(lead.id, lead.gclid!, lead.accountId)` for each
- [x] 5.3 Return `202 { "queued": N }` where N is the count of eligible leads before `after()` is invoked
