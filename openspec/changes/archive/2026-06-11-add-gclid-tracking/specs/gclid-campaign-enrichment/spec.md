## ADDED Requirements

### Requirement: Lead with gclid triggers post-response enrichment
When a lead is saved with a non-null `gclid`, the system SHALL schedule enrichment via `after()` after the Prisma transaction commits. The conversion response SHALL be returned to the client before enrichment runs. The `enrichment_status` field SHALL be set to `PENDING` during lead creation.

#### Scenario: Enrichment scheduled after successful lead save
- **WHEN** `POST /api/conversion` saves a lead with a non-null `gclid`
- **THEN** `after(() => enrichLeadFromGclid(...))` is registered, lead `enrichment_status` is `PENDING`, and the 200 response is returned to the client immediately

#### Scenario: Lead with no gclid skips enrichment scheduling
- **WHEN** `POST /api/conversion` saves a lead with `gclid` null or absent
- **THEN** no enrichment is scheduled and `enrichment_status` remains `NULL`

### Requirement: Successful enrichment writes campaign fields and marks ENRICHED
When the Google Ads API returns ClickView data for the `gclid`, the system SHALL write all available fields to the `Customer` record and set `enrichment_status` to `ENRICHED`.

Fields written (when present in API response):
- `campaign_id`, `campaign_name`
- `ad_group_id`, `ad_group_name`
- `gclid_keyword`, `gclid_match_type`
- `gclid_ad_id`
- `gclid_click_date`

#### Scenario: Full ClickView data returned
- **WHEN** Google Ads API returns a ClickView record matching the `gclid`
- **THEN** all available campaign fields are persisted on the `Customer` record and `enrichment_status` is set to `ENRICHED`

#### Scenario: Partial ClickView data returned
- **WHEN** Google Ads API returns a ClickView record with some fields absent
- **THEN** available fields are persisted, absent fields remain `NULL`, and `enrichment_status` is set to `ENRICHED`

### Requirement: Enrichment failure sets FAILED status without affecting lead
When the Google Ads API call fails for any reason (network error, auth error, no data found, API rate limit), the system SHALL set `enrichment_status` to `FAILED`, persist the error message in `enrichment_error`, and leave all other lead fields unchanged.

#### Scenario: Google Ads API returns an error
- **WHEN** the Google Ads API call throws or returns a non-success response
- **THEN** `enrichment_status` is set to `FAILED`, `enrichment_error` contains the error message, and the lead record is otherwise unmodified

#### Scenario: ClickView query returns no results — not marked ENRICHED
- **WHEN** Google Ads API returns an empty result set for the `gclid` (data not yet processed by Google)
- **THEN** `enrichment_status` is set to `FAILED` and `enrichment_error` is set to `"No ClickView data found for gclid"` — the lead MUST NOT be marked `ENRICHED` and MUST remain retryable

#### Scenario: Operator retries after ClickView delay
- **WHEN** operator clicks retry on a lead whose `FAILED` status was caused by an empty ClickView response
- **THEN** enrichment runs again via `POST /api/admin/leads/[id]/enrich` — if Google has since processed the data, status becomes `ENRICHED`; if still empty, status remains `FAILED`

#### Scenario: Enrichment failure does not affect conversion response
- **WHEN** enrichment fails after lead was saved
- **THEN** the original conversion response (200 with attendant info) is unaffected and the lead record exists with valid registration data

### Requirement: Missing credentials sets SKIPPED status
When an account has no Google Ads credentials configured (`googleAdsCustomerId` or `googleAdsRefreshToken` absent on `ButtonConfig`), enrichment SHALL set `enrichment_status` to `SKIPPED` without calling the Google Ads API.

#### Scenario: Account has no Google Ads credentials
- **WHEN** `enrichLeadFromGclid` runs for an account with `googleAdsCustomerId` or `googleAdsRefreshToken` absent
- **THEN** `enrichment_status` is set to `SKIPPED` and no Google Ads API call is made

#### Scenario: Global developer token env var absent
- **WHEN** `GOOGLE_ADS_DEVELOPER_TOKEN` env var is not set
- **THEN** `enrichment_status` is set to `SKIPPED` and `enrichment_error` is set to `"Google Ads developer token not configured"`

### Requirement: Admin can manually retry enrichment for FAILED leads
The system SHALL expose `POST /api/admin/leads/[id]/enrich` (admin-only). When called, it SHALL re-run enrichment synchronously and update the `Customer` record. Only leads with `enrichment_status = FAILED` MAY be retried.

#### Scenario: Successful manual retry
- **WHEN** admin POSTs to `/api/admin/leads/[id]/enrich` for a lead with `enrichment_status = FAILED`
- **THEN** enrichment runs synchronously, `enrichment_status` is updated to `ENRICHED` or `FAILED`, and the updated lead is returned in the response

#### Scenario: Retry on non-retryable lead rejected
- **WHEN** admin POSTs to `/api/admin/leads/[id]/enrich` for a lead with `enrichment_status` of `ENRICHED` or `SKIPPED`, or with `NULL` status and no `gclid`
- **THEN** the API returns 409 with an error message

### Requirement: Pre-feature leads with gclid can have enrichment manually triggered
Leads registered before this feature was deployed may have a `gclid` but `enrichment_status = NULL`. These SHALL be treated as retryable — the manual trigger endpoint SHALL accept them and run enrichment. The leads table SHALL show a trigger button for these leads.

#### Scenario: NULL-status lead with gclid shows trigger button
- **WHEN** leads table renders a lead with `gclid` set and `enrichment_status = NULL`
- **THEN** a "Enriquecer" button is shown on that row (distinct from the FAILED warning icon)

#### Scenario: Manual trigger for NULL-status lead
- **WHEN** admin POSTs to `/api/admin/leads/[id]/enrich` for a lead with `enrichment_status = NULL` and a non-null `gclid`
- **THEN** enrichment runs and status becomes `ENRICHED` or `FAILED`

#### Scenario: Retry requires admin session
- **WHEN** an unauthenticated request is made to `/api/admin/leads/[id]/enrich`
- **THEN** the API returns 401

### Requirement: Admin can batch-retry all FAILED leads in the current view
The leads page SHALL provide a "Reprocessar falhos" button in the page header. When clicked, it SHALL iterate sequentially (one at a time, awaiting each before the next) through all `FAILED` leads in the currently visible filtered list, calling `POST /api/admin/leads/[id]/enrich` for each. Progress SHALL be displayed inline. The batch operates only on the current view (active date range + search filters), not all leads in the account.

#### Scenario: Batch retry processes FAILED leads sequentially
- **WHEN** operator clicks "Reprocessar falhos" with N FAILED leads in the current view
- **THEN** the system calls `/api/admin/leads/[id]/enrich` for each FAILED lead one at a time (not in parallel), updates each row as it resolves, and shows progress (e.g. "3 / 7")

#### Scenario: Batch retry button absent when no FAILED leads in view
- **WHEN** the current view contains no leads with `enrichment_status = FAILED`
- **THEN** the "Reprocessar falhos" button is disabled or hidden

#### Scenario: Batch retry respects current filters
- **WHEN** operator has applied date range or search filters
- **THEN** only FAILED leads matching those filters are included in the batch — leads outside the current view are not affected

#### Scenario: Batch retry can be observed in progress
- **WHEN** batch retry is running
- **THEN** the button shows progress ("Reprocessando 3 / 7...") and individual rows update as each lead completes

### Requirement: Backoffice leads table surfaces enrichment status
The admin leads page SHALL display `enrichment_status` for leads that have a `gclid`. Leads with `enrichment_status = FAILED` SHALL show a warning icon with a per-row retry button. Leads with `enrichment_status = ENRICHED` SHALL show resolved campaign fields.

#### Scenario: FAILED lead shown with warning icon and retry button
- **WHEN** leads table renders a lead with `enrichment_status = FAILED`
- **THEN** a warning icon is displayed and a retry button is available on that row

#### Scenario: ENRICHED lead shows campaign fields
- **WHEN** leads table renders a lead with `enrichment_status = ENRICHED`
- **THEN** `campaign_name`, `ad_group_name`, and `gclid_keyword` columns are populated

#### Scenario: NULL enrichment status (no gclid) shows no enrichment UI
- **WHEN** leads table renders a lead with `enrichment_status = NULL`
- **THEN** no enrichment icon, status, or retry button is shown
