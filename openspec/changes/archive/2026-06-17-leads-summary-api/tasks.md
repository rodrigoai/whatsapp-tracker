## 1. Rename LAMBDA_API_SECRET → API_SECRET

- [x] 1.1 Update `src/app/api/lambda/enrich-batch/route.ts` to read `process.env.API_SECRET` instead of `process.env.LAMBDA_API_SECRET`
- [x] 1.2 Update `.env.example` (or equivalent) to replace `LAMBDA_API_SECRET` with `API_SECRET`
- [x] 1.3 Update documentation / Lambda deployment config to use new env var name

## 2. Implement the summary endpoint

- [x] 2.1 Create `src/app/api/leads/summary/route.ts` with a `GET` handler
- [x] 2.2 Validate Bearer token from `Authorization` header against `API_SECRET` using `timingSafeEqual`; return 503 if `API_SECRET` unset, 401 if token missing or invalid
- [x] 2.3 Parse and validate `accountId`, `from`, `to` query params; return 400 with descriptive message if any is missing or if dates are not valid `YYYY-MM-DD`
- [x] 2.4 Compute UTC date bounds: `from` → `00:00:00.000Z`, `to` → `23:59:59.999Z`
- [x] 2.5 Execute `prisma.$queryRaw` with the aggregation query (CASE WHEN gclid, COALESCE campaign, COUNT + SUM for funnel stages, GROUP BY, ORDER BY source + campaign)
- [x] 2.6 Cast `COUNT`/`SUM` results to `Number` (PostgreSQL returns BigInt from raw queries)
- [x] 2.7 Return `{ groups: [...] }` with status 200; return `{ groups: [] }` when no rows match

## 3. Tests

- [x] 3.1 Test 401 when `Authorization` header is missing
- [x] 3.2 Test 401 when token does not match `API_SECRET`
- [x] 3.3 Test 503 when `API_SECRET` env var is not set
- [x] 3.4 Test 400 for each missing required param (`accountId`, `from`, `to`)
- [x] 3.5 Test 400 for invalid date format in `from` or `to`
- [x] 3.6 Test correct funnel counts (leads / proposals / sales) with mocked `prisma.$queryRaw` result
- [x] 3.7 Test empty result returns `{ groups: [] }` with 200
- [x] 3.8 Test that `enrich-batch` route still works after `LAMBDA_API_SECRET` → `API_SECRET` rename
