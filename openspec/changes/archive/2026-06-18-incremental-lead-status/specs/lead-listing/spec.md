## MODIFIED Requirements

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
