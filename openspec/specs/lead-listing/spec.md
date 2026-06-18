## ADDED Requirements

### Requirement: Authentication via API secret
The endpoint SHALL require a valid `Authorization: Bearer <token>` header matching the `API_SECRET` environment variable, verified with a timing-safe comparison. If `API_SECRET` is not configured, the endpoint SHALL return 503. If the header is missing or the token does not match, the endpoint SHALL return 401.

#### Scenario: Missing authorization header
- **WHEN** a request is made without an `Authorization` header
- **THEN** the system returns HTTP 401 with `{ "error": "Unauthorized" }`

#### Scenario: Invalid token
- **WHEN** a request is made with `Authorization: Bearer wrong-token`
- **THEN** the system returns HTTP 401 with `{ "error": "Unauthorized" }`

#### Scenario: API_SECRET not configured
- **WHEN** `API_SECRET` environment variable is not set and a request is made
- **THEN** the system returns HTTP 503 with `{ "error": "Not configured" }`

#### Scenario: Valid token
- **WHEN** a request is made with the correct `Authorization: Bearer <API_SECRET>` header
- **THEN** the system proceeds to process the request

---

### Requirement: Account scoping
The endpoint SHALL require an `account_id` query parameter. All returned leads MUST belong to that account. If `account_id` is absent, the endpoint SHALL return 400.

#### Scenario: Missing account_id
- **WHEN** a request is made without the `account_id` query parameter
- **THEN** the system returns HTTP 400 with `{ "error": "account_id is required" }`

#### Scenario: Valid account_id
- **WHEN** a request is made with a valid `account_id`
- **THEN** the system returns only leads belonging to that account

---

### Requirement: Paginated lead listing
The endpoint `GET /api/leads` SHALL return leads for the given account in reverse-chronological order (`conversionTime DESC`, `id DESC` as tiebreaker), wrapped in a pagination envelope. Default `page_size` is 50; callers may specify `page_size` up to a maximum of 200. Requests with `page_size` above 200 SHALL be rejected with 400.

#### Scenario: First page with no cursor
- **WHEN** a request is made with a valid `account_id` and no `cursor` parameter
- **THEN** the system returns the first page of leads ordered by `conversionTime DESC` and `{ "pagination": { "next_cursor": "<string or null>", "has_more": <bool>, "page_size": <number> } }`

#### Scenario: Subsequent page via cursor
- **WHEN** a request is made with a `cursor` value returned in a previous response
- **THEN** the system returns the next page of leads continuing from that cursor position

#### Scenario: Last page
- **WHEN** there are no more leads after the current page
- **THEN** `pagination.next_cursor` is `null` and `pagination.has_more` is `false`

#### Scenario: Invalid cursor
- **WHEN** a request is made with a malformed or tampered `cursor` value
- **THEN** the system returns HTTP 400 with `{ "error": "Invalid cursor" }`

#### Scenario: page_size exceeds maximum
- **WHEN** a request is made with `page_size=201`
- **THEN** the system returns HTTP 400 with `{ "error": "pageSize must be between 1 and 200" }`

---

### Requirement: Optional date range filter
The endpoint SHALL accept optional `from` and `to` query parameters in `YYYY-MM-DD` format. When provided, both MUST be present; supplying only one SHALL return 400. Dates are treated as UTC calendar days — `from` maps to `T00:00:00.000Z` and `to` maps to `T23:59:59.999Z`. No timezone conversion is applied.

#### Scenario: Both from and to provided
- **WHEN** a request includes `from=2024-01-01&to=2024-01-31`
- **THEN** only leads with `conversionTime` between 2024-01-01T00:00:00.000Z and 2024-01-31T23:59:59.999Z are returned

#### Scenario: Only from provided
- **WHEN** a request includes `from=2024-01-01` without `to`
- **THEN** the system returns HTTP 400 with `{ "error": "Both from and to are required when filtering by date" }`

#### Scenario: Invalid date format
- **WHEN** a request includes `from=01-01-2024`
- **THEN** the system returns HTTP 400 with `{ "error": "Invalid date format (use YYYY-MM-DD)" }`

#### Scenario: No date filter
- **WHEN** a request is made without `from` or `to`
- **THEN** all leads for the account are eligible (no date restriction)

---

### Requirement: Optional status filter
The endpoint SHALL accept an optional `status` query parameter (repeatable). Valid values are `Not Qualified`, `Proposta`, and `Venda`. `Not Qualified` MUST match leads where the `status` array is empty (`[]`). `Proposta` and `Venda` MUST match leads where the `status` array contains that value. Multiple values are combined with OR. An unrecognized status value SHALL return 400.

#### Scenario: Filter by single status
- **WHEN** a request includes `status=Venda`
- **THEN** only leads whose `status` array contains `"Venda"` are returned

#### Scenario: Filter by Not Qualified maps to empty array
- **WHEN** a request includes `status=Not%20Qualified`
- **THEN** only leads where `status` is an empty array (`[]`) are returned

#### Scenario: Multiple status values
- **WHEN** a request includes `status=Proposta&status=Venda`
- **THEN** leads whose `status` array contains `"Proposta"` OR `"Venda"` are returned (a lead with both is included once)

#### Scenario: Unknown status value
- **WHEN** a request includes `status=Unknown`
- **THEN** the system returns HTTP 400 with `{ "error": "Invalid status value: Unknown" }`

#### Scenario: No status filter
- **WHEN** a request is made without the `status` parameter
- **THEN** leads of all statuses are returned

---

### Requirement: Response field set
Each lead object SHALL have top-level core fields and a `google_ads` nested object.

**Top-level:** `id`, `name`, `email`, `phone`, `status`, `conversion_time`, `conversion_name`, `value`, `currency`, `utm_source`, `utm_campaign`, `utm_medium`, `enrichment_status`

The `status` field SHALL be a `string[]` containing all status milestones the lead has reached, in insertion order. An empty array `[]` means no status has been assigned (replaces the former `null`). The field name is kept as `status` (not renamed) to preserve API compatibility.

**`google_ads` object:** `gclid`, `gbraid`, `wbraid`, `campaign_id`, `campaign_name`, `ad_group_id`, `ad_group_name`, `gclid_keyword`, `gclid_match_type`, `gclid_ad_id`, `gclid_click_date`, `gclid_ad_network_type`, `gclid_page_number`, `gclid_geo_interest_country`, `gclid_geo_interest_region`, `gclid_geo_presence_country`, `gclid_geo_presence_region`

The internal diagnostic field `enrichment_error` SHALL be excluded from the response entirely.

#### Scenario: Response status is an array
- **WHEN** a valid request returns leads
- **THEN** each lead object contains `status: string[]`

#### Scenario: Lead with no status returns empty array
- **WHEN** a lead has no status milestones
- **THEN** `status` is `[]`

#### Scenario: Lead with multiple milestones returns full array
- **WHEN** a lead has reached both `"Proposta"` and `"Venda"`
- **THEN** `status` is `["Proposta", "Venda"]`

#### Scenario: Response nests Google Ads data under google_ads key
- **WHEN** a valid request returns leads
- **THEN** each lead object contains a `google_ads` object with click IDs and enrichment fields, and `gclid`/`gbraid`/`wbraid` are NOT present at the top level

#### Scenario: enrichment_error excluded
- **WHEN** a valid request is made
- **THEN** no lead object contains `enrichment_error` at any level
