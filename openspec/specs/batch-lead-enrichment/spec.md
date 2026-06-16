### Requirement: Lambda caller authenticates with shared bearer secret
`POST /api/lambda/enrich-batch` SHALL validate the `Authorization: Bearer <token>` header against the `LAMBDA_API_SECRET` environment variable before processing any request.

#### Scenario: Valid secret accepted
- **WHEN** request includes `Authorization: Bearer <value>` where `<value>` matches `LAMBDA_API_SECRET`
- **THEN** the request proceeds to processing

#### Scenario: Missing Authorization header rejected with 401
- **WHEN** request has no `Authorization` header
- **THEN** the endpoint returns 401 with `{ "error": "Unauthorized" }` and does NOT enqueue any enrichment

#### Scenario: Wrong secret rejected with 401
- **WHEN** request includes `Authorization: Bearer <wrong-value>` that does not match `LAMBDA_API_SECRET`
- **THEN** the endpoint returns 401 with `{ "error": "Unauthorized" }` and does NOT enqueue any enrichment

#### Scenario: LAMBDA_API_SECRET env var not set — endpoint unavailable
- **WHEN** `LAMBDA_API_SECRET` is not set in the environment
- **THEN** every request to the endpoint returns 503 with `{ "error": "Batch enrichment not configured" }`

### Requirement: Endpoint accepts a date parameter and returns 202 immediately
`POST /api/lambda/enrich-batch` SHALL accept a JSON body with a `date` field (ISO 8601, `YYYY-MM-DD`), start background enrichment via `after()`, and return `202 Accepted` before enrichment completes.

#### Scenario: Valid date triggers background batch and returns 202
- **WHEN** authenticated request with body `{ "date": "2025-06-10" }` is received
- **THEN** the endpoint responds `202 { "queued": N }` where N is the count of eligible leads found, and enrichment begins asynchronously via `after()`

#### Scenario: Missing date field rejected with 400
- **WHEN** authenticated request has no `date` field in body
- **THEN** the endpoint returns 400 with `{ "error": "date is required (YYYY-MM-DD)" }` and no enrichment runs

#### Scenario: Malformed date rejected with 400
- **WHEN** authenticated request has `date` field that is not a valid `YYYY-MM-DD` string (e.g. `"today"`, `"2025-13-01"`)
- **THEN** the endpoint returns 400 with `{ "error": "Invalid date format" }` and no enrichment runs

#### Scenario: No eligible leads — returns 202 with queued 0
- **WHEN** authenticated request with valid date arrives but no leads match eligibility criteria for that date
- **THEN** the endpoint returns `202 { "queued": 0 }` and no `after()` callback is registered

### Requirement: Eligible leads are those with gclid set and not yet ENRICHED for the given date
The batch SHALL query `Customer` records where `gclid IS NOT NULL`, `enrichment_status != 'ENRICHED'`, and the `conversionTime` date (UTC) equals the requested date. Leads with status `FAILED`, `PENDING`, `SKIPPED`, or `NULL` are all eligible.

#### Scenario: FAILED leads for the date are included
- **WHEN** batch runs for a date
- **THEN** all leads with `enrichment_status = 'FAILED'` and `conversionTime` on that date are included

#### Scenario: SKIPPED leads for the date are included
- **WHEN** batch runs for a date
- **THEN** all leads with `enrichment_status = 'SKIPPED'` and `conversionTime` on that date are included

#### Scenario: NULL-status leads with gclid for the date are included
- **WHEN** batch runs for a date
- **THEN** leads with `enrichment_status = NULL`, non-null `gclid`, and `conversionTime` on that date are included

#### Scenario: ENRICHED leads are excluded
- **WHEN** batch runs for a date
- **THEN** leads with `enrichment_status = 'ENRICHED'` are NOT re-processed

#### Scenario: Leads from other dates are excluded
- **WHEN** batch runs for date `2025-06-10`
- **THEN** leads with `conversionTime` outside that date are NOT included, even if eligible by status

### Requirement: Enrichment runs sequentially in background, one lead at a time
The `after()` callback SHALL call `enrichLeadFromGclid(lead.id, lead.gclid, lead.accountId)` for each eligible lead sequentially, awaiting each before starting the next.

#### Scenario: Sequential execution — second lead waits for first
- **WHEN** two eligible leads exist for the date
- **THEN** enrichment of the second lead MUST NOT begin until the first completes (no parallel calls)

#### Scenario: Failure of one lead does not stop the batch
- **WHEN** `enrichLeadFromGclid` sets a lead to `FAILED` (e.g. API error)
- **THEN** the batch continues and processes remaining leads — `enrichLeadFromGclid` already handles its own errors without throwing

#### Scenario: Each lead's status updated by enrichLeadFromGclid
- **WHEN** batch processes a lead
- **THEN** the lead's `enrichment_status` is updated to `ENRICHED`, `FAILED`, or `SKIPPED` by `enrichLeadFromGclid` — the batch endpoint does NOT write status directly
