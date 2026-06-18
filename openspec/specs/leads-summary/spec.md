# Leads Summary Spec

## Requirement: Bearer token authentication
The endpoint SHALL require a valid `Authorization: Bearer <token>` header. The token MUST be compared against the `API_SECRET` environment variable using a timing-safe comparison. If `API_SECRET` is not configured, the endpoint SHALL return 503.

### Scenario: Valid token accepted
- **WHEN** request includes `Authorization: Bearer <value>` where `<value>` matches `API_SECRET`
- **THEN** system processes the request normally

### Scenario: Missing authorization header
- **WHEN** request has no `Authorization` header
- **THEN** system returns 401 Unauthorized

### Scenario: Invalid token rejected
- **WHEN** request includes `Authorization: Bearer <wrong-value>`
- **THEN** system returns 401 Unauthorized

### Scenario: API_SECRET not configured
- **WHEN** `API_SECRET` environment variable is not set
- **THEN** system returns 503 Service Unavailable

---

## Requirement: Required query parameters
The endpoint SHALL require `accountId`, `from`, and `to` query parameters. Any missing parameter MUST result in a 400 error. `from` and `to` MUST be valid dates in `YYYY-MM-DD` format.

### Scenario: All parameters present
- **WHEN** request includes valid `accountId`, `from`, and `to`
- **THEN** system processes the request

### Scenario: Missing accountId
- **WHEN** request omits `accountId`
- **THEN** system returns 400 Bad Request with a descriptive error message

### Scenario: Missing from
- **WHEN** request omits `from`
- **THEN** system returns 400 Bad Request with a descriptive error message

### Scenario: Missing to
- **WHEN** request omits `to`
- **THEN** system returns 400 Bad Request with a descriptive error message

### Scenario: Invalid date format
- **WHEN** `from` or `to` is not a valid `YYYY-MM-DD` date
- **THEN** system returns 400 Bad Request with a descriptive error message

---

## Requirement: Date range filtering
The system SHALL return only `Customer` records whose `conversionTime` falls within the requested date range. `from` SHALL be treated as the start of the day (00:00:00 UTC). `to` SHALL be treated as the end of the day (23:59:59.999 UTC), making the range fully inclusive.

### Scenario: Lead within range included
- **WHEN** a customer's `conversionTime` falls on or between `from` and `to`
- **THEN** the customer is included in the aggregation

### Scenario: Lead outside range excluded
- **WHEN** a customer's `conversionTime` is before `from` or after end-of-day `to`
- **THEN** the customer is excluded from the aggregation

---

## Requirement: Origin classification
Each `Customer` record SHALL be classified into an source based on tracking fields:
- `gclid` is not null → source `"Google"`
- Otherwise → source `"Organic"`

### Scenario: Customer with gclid classified as Google
- **WHEN** a customer record has a non-null `gclid` value
- **THEN** source is `"Google"`

### Scenario: Customer without gclid classified as Organic
- **WHEN** a customer record has a null `gclid`
- **THEN** source is `"Organic"`

---

## Requirement: Campaign grouping
Each `Customer` record SHALL be assigned a `campaignId` (from `campaign_id`, null if absent) and a `campaign` label using the first non-null value from: `campaign_name` → `utm_campaign` → `"(sem campanha)"`. Records are grouped by `{ source, campaignId, campaign }`.

### Scenario: Enriched campaign data used
- **WHEN** customer has non-null `campaign_id` and `campaign_name`
- **THEN** group key uses `campaignId = campaign_id` and `campaign = campaign_name`

### Scenario: utm_campaign fallback
- **WHEN** customer has null `campaign_id` and null `campaign_name` but non-null `utm_campaign`
- **THEN** `campaignId` is null and `campaign` is `utm_campaign`

### Scenario: No campaign data
- **WHEN** `campaign_id`, `campaign_name`, and `utm_campaign` are all null
- **THEN** `campaignId` is null and `campaign` is `"(sem campanha)"`

---

## Requirement: Sales funnel counts
Within each `{ source, campaign }` group, the system SHALL count:
- `leads`: total number of records in the group
- `proposals`: records where `status` array contains `"Proposta"`
- `sales`: records where `status` array contains `"Venda"`

A lead that has both `"Proposta"` and `"Venda"` in its `status` array MUST be counted in both `proposals` and `sales`.

### Scenario: Funnel counts computed correctly with incremental statuses
- **WHEN** a group contains 10 records, 3 with `"Proposta"` in their `status` array, 1 with `"Venda"` in their `status` array, and 1 with both `"Proposta"` and `"Venda"` in their `status` array
- **THEN** response shows `{ leads: 10, proposals: 4, sales: 2 }`

### Scenario: No proposals or sales
- **WHEN** all records in a group have `status = []`
- **THEN** response shows `{ proposals: 0, sales: 0 }`

### Scenario: Lead counted in both proposals and sales
- **WHEN** a lead has `status = ["Proposta", "Venda"]`
- **THEN** the lead is counted in both `proposals` and `sales`

---

## Requirement: Response format and ordering
The endpoint SHALL return `200 OK` with a JSON body containing a `groups` array. Groups SHALL be sorted ascending by `source` then by `campaign` (both alphabetically). Empty result (no customers match) SHALL return an empty `groups` array, not an error.

### Scenario: Successful response structure
- **WHEN** request is valid and matching customers exist
- **THEN** response is `{ "groups": [{ "source": string, "campaignId": string | null, "campaign": string, "leads": number, "proposals": number, "sales": number }] }`

### Scenario: No matching customers
- **WHEN** no customers exist for the given `accountId` and date range
- **THEN** response is `{ "groups": [] }` with status 200

### Scenario: Groups sorted by source then campaign
- **WHEN** result contains groups for `"Organic"/"(sem campanha)"`, `"Google"/"Campanha B"`, `"Google"/"Campanha A"`
- **THEN** order is `Google/Campanha A`, `Google/Campanha B`, `Organic/(sem campanha)`
