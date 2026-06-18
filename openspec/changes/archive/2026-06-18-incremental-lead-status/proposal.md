## Why

The current `status` field on `Customer` is a single string that gets replaced on import, causing the sales funnel to undercount `Proposta` leads: a lead that progressed to `Venda` no longer appears in `Proposta` counts. Status transitions must be tracked incrementally so each milestone in the funnel is preserved.

## What Changes

- Change `Customer.status` from `String?` to `String[]` (array of strings).
- Import logic stops overwriting status; it now appends the incoming status to the array only when it is not already present.
- The `leads-summary` funnel counts (`proposals`, `sales`) change from `COUNT WHERE status = X` to `COUNT WHERE status array contains X`.
- The `lead-listing` API returns the full `statuses` array per lead instead of a single status string.
- **BREAKING**: `Customer.status` column type changes from `String?` to `String[]`; existing single-value rows are migrated to single-element arrays.

## Capabilities

### New Capabilities
- `lead-status-history`: Logic for appending a new status value to `Customer.statuses` during import, preventing duplicates.

### Modified Capabilities
- `leads-summary`: Funnel counts (`proposals`, `sales`) must use array-contains queries instead of equality checks.
- `lead-listing`: The `status` field in the lead response is replaced with a `statuses` array.

## Impact

- **Database**: `Customer.status` column type changes to array; migration needed to convert existing string values to single-element arrays.
- **Import logic**: Any code path that sets `Customer.status` must switch to an append operation (add to array if not already present).
- **API**: `GET /api/leads` response shape changes (`status: string | null` → `statuses: string[]`). `GET /api/leads/summary` query changes.
- **Dependencies**: No new packages required; Prisma migration needed. Note: SQLite does not natively support array columns — switch to JSON-encoded array or migrate to PostgreSQL if not already planned.
