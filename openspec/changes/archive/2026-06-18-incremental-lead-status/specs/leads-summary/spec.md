## MODIFIED Requirements

### Requirement: Sales funnel counts
Within each `{ source, campaign }` group, the system SHALL count:
- `leads`: total number of records in the group
- `proposals`: records where `status` array contains `"Proposta"`
- `sales`: records where `status` array contains `"Venda"`

A lead that has both `"Proposta"` and `"Venda"` in its `status` array MUST be counted in both `proposals` and `sales`.

#### Scenario: Funnel counts computed correctly with incremental statuses
- **WHEN** a group contains 10 records, 3 with `"Proposta"` in their `status` array, 1 with `"Venda"` in their `status` array, and 1 with both `"Proposta"` and `"Venda"` in their `status` array
- **THEN** response shows `{ leads: 10, proposals: 4, sales: 2 }`

#### Scenario: No proposals or sales
- **WHEN** all records in a group have `status = []`
- **THEN** response shows `{ proposals: 0, sales: 0 }`

#### Scenario: Lead counted in both proposals and sales
- **WHEN** a lead has `status = ["Proposta", "Venda"]`
- **THEN** the lead is counted in both `proposals` and `sales`
