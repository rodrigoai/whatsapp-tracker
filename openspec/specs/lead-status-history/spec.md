## ADDED Requirements

### Requirement: Customer status stored as ordered array
The `Customer` model SHALL store `status` as `String[]` (Postgres native array, default empty array `[]`). Each element represents a sales funnel milestone that the lead has reached. The array is ordered by insertion time (earliest first). Null is no longer a valid value — an empty array represents a lead with no status.

#### Scenario: New lead has empty status array
- **WHEN** a new `Customer` record is created via the conversion API
- **THEN** `status` is `[]` (empty array)

#### Scenario: Status array preserves all milestones
- **WHEN** a lead has been imported twice — once as `"Proposta"` and once as `"Venda"`
- **THEN** `status` is `["Proposta", "Venda"]`

---

### Requirement: Import appends status milestone without duplicates
During import (`POST /api/admin/import-results`), the system SHALL append the incoming status value to `Customer.status` only if that value is not already present in the array. If the value is already present, the array MUST NOT be modified.

#### Scenario: First status appended to empty array
- **WHEN** a matched lead has `status = []` and the import status is `"Proposta"`
- **THEN** `status` becomes `["Proposta"]`

#### Scenario: New milestone appended to existing array
- **WHEN** a matched lead has `status = ["Proposta"]` and the import status is `"Venda"`
- **THEN** `status` becomes `["Proposta", "Venda"]`

#### Scenario: Duplicate milestone not appended
- **WHEN** a matched lead has `status = ["Proposta"]` and the import status is `"Proposta"`
- **THEN** `status` remains `["Proposta"]` and the record is still counted as updated

#### Scenario: Both milestones present — no change
- **WHEN** a matched lead has `status = ["Proposta", "Venda"]` and the import status is `"Venda"`
- **THEN** `status` remains `["Proposta", "Venda"]`
