## 1. Auth Helper

- [x] 1.1 Extract `checkAuth` from `src/app/api/leads/summary/route.ts` into `src/lib/api-auth.ts` (reuse in new route)
- [x] 1.2 Update `src/app/api/leads/summary/route.ts` to import from `src/lib/api-auth.ts`
- [x] 1.3 Update `src/app/api/lambda/enrich-batch/route.ts` to import from `src/lib/api-auth.ts`

## 2. Core Route

- [x] 2.1 Create `src/app/api/leads/route.ts` with `GET` handler
- [x] 2.2 Validate `accountId` query param — return 400 if missing
- [x] 2.3 Call `checkAuth` at the top of the handler — return early on auth failure

## 3. Date Filter

- [x] 3.1 Extract `parseDateOnly` from `src/app/api/admin/leads/route.ts` into `src/lib/date-utils.ts`
- [x] 3.2 Update `src/app/api/admin/leads/route.ts` to import from `src/lib/date-utils.ts`
- [x] 3.3 Apply date filter in new route: require both `from` and `to` when either is present; return 400 on missing or invalid

## 4. Status Filter

- [x] 4.1 Accept repeatable `status` query params; validate each against `["Not Qualified", "Proposta", "Venda"]` — return 400 on unknown value
- [x] 4.2 Build Prisma `OR` condition: `Not Qualified` → `{ status: null }`, others → `{ status: value }`
- [x] 4.3 Skip status filter entirely when no `status` params provided

## 5. Cursor Pagination

- [x] 5.1 Validate `pageSize` param: default 50, max 200, return 400 if exceeded
- [x] 5.2 Implement cursor encode/decode: base64 JSON of `{ conversionTime: string, id: string }` — return 400 on decode failure
- [x] 5.3 Apply cursor as Prisma `where` clause: `OR [{ conversionTime: { lt: cursorTime } }, { conversionTime: cursorTime, id: { lt: cursorId } }]`
- [x] 5.4 Fetch `pageSize + 1` rows; if extra row exists set `hasMore: true` and drop it from response
- [x] 5.5 Compute `nextCursor` from last included row (null when `hasMore` is false)

## 6. Response Shape

- [x] 6.1 Select only allowed fields: `id`, `name`, `email`, `phone`, `status`, `conversionTime`, `conversionName`, `value`, `currency`, `gclid`, `gbraid`, `wbraid`, `utm_source`, `utm_campaign`, `utm_medium`
- [x] 6.2 Return `{ data: Lead[], pagination: { nextCursor, hasMore, pageSize } }`

## 7. Tests

- [x] 7.1 Test 401 when auth header missing or invalid
- [x] 7.2 Test 503 when `API_SECRET` not set
- [x] 7.3 Test 400 when `accountId` missing
- [x] 7.4 Test 400 when only `from` or only `to` provided, and when date format is invalid
- [x] 7.5 Test 400 when unknown `status` value provided
- [x] 7.6 Test 400 when `pageSize` exceeds 200 or cursor is malformed
- [x] 7.7 Test first page returns correct leads in reverse-chronological order (mock Prisma)
- [x] 7.8 Test cursor pagination: second page continues from cursor (mock Prisma)
- [x] 7.9 Test `Not Qualified` status maps to `status: null` in Prisma query
- [x] 7.10 Test response excludes enrichment internal fields
