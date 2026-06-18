## Context

`Customer.status` is currently a `String?` column set to `"Proposta"` or `"Venda"` during import (`POST /api/admin/import-results`). Each import overwrites the previous value, so a lead that progresses to `"Venda"` vanishes from the `"Proposta"` count in the sales funnel summary. The fix is to make `status` an ordered array where each milestone is appended once.

The project already uses PostgreSQL, which supports native array columns. Prisma supports `String[]` on Postgres with array-specific operators (`has`, `push`).

## Goals / Non-Goals

**Goals:**
- Change `Customer.status` to `String[]` so multiple milestones are preserved.
- Import logic appends a status value only when it is not already in the array.
- `leads-summary` funnel counts reflect any lead that ever reached a milestone.
- `leads` listing API returns `status: string[]` (array) instead of `status: string | null`.
- Status filter in `GET /api/leads` works with the new array column.

**Non-Goals:**
- Timestamps per status transition (not requested).
- Ordering or reordering of status values beyond append order.
- New status values beyond `"Proposta"` and `"Venda"`.

## Decisions

### 1. Native Postgres `String[]` over a join table

A `CustomerStatus` child table would give timestamps and full history. However, the requirement is only to record which milestones have been reached, not when. A `String[]` column is simpler: no join, no extra migration complexity, and Prisma supports array filter operators natively on Postgres.

**Alternative considered**: separate `CustomerStatus` table — rejected because timestamp tracking is out of scope and adds join overhead to every query.

### 2. Append-only via Prisma `push` guarded by `has` check

Prisma does not have an atomic "add if absent" array operation on Postgres. The safest pattern is:
1. Check if `status` array already `has` the incoming value.
2. If not, use `{ status: { push: value } }` in the update.

This is a two-step operation per row. Since import is a batch admin operation (not high-throughput), the extra read is acceptable. No race condition risk — imports are serialized per admin session.

**Alternative considered**: raw SQL `array_append` + `NOT (status @> ARRAY[val])` in one statement — valid but bypasses Prisma type safety; not worth the complexity here.

### 3. Summary query: replace raw SQL `SUM(CASE WHEN status = X)` with Prisma aggregation

The current `/api/leads/summary` uses a raw `$queryRaw` with `SUM(CASE WHEN status = 'Proposta')`. With `String[]`, the equivalent Postgres expression is `(status @> ARRAY['Proposta'])`. The raw SQL query must be updated to use array containment:

```sql
SUM(CASE WHEN status @> ARRAY['Proposta'] THEN 1 ELSE 0 END) AS proposals,
SUM(CASE WHEN status @> ARRAY['Venda']    THEN 1 ELSE 0 END) AS sales
```

### 4. Leads listing status filter: `has` instead of equality

`GET /api/leads` accepts `?status=Proposta&status=Venda`. Currently this maps to `{ OR: [{ status: 'Proposta' }, { status: 'Venda' }] }`. With the array column, each term maps to `{ status: { has: value } }`, combined with `OR` as before. `"Not Qualified"` maps to `{ status: { isEmpty: true } }` instead of `{ status: null }`.

### 5. API field name: keep `status`, change type only

The response field is kept as `status` (not renamed to `statuses`) to preserve backwards compatibility with existing API consumers. The type changes from `string | null` to `string[]`. An empty array `[]` replaces `null` for unqualified leads.

### 6. Migration strategy

Prisma cannot migrate `String?` to `String[]` in one `ALTER COLUMN`. The migration:
1. Adds `status_new TEXT[] NOT NULL DEFAULT '{}'`.
2. Backfills: `UPDATE "Customer" SET status_new = ARRAY[status] WHERE status IS NOT NULL`.
3. Drops old `status` column.
4. Renames `status_new` → `status`.

Done in a single hand-written migration file.

## Risks / Trade-offs

- **Migration is destructive**: Once `status` is converted to an array, rollback requires a reverse migration. → Keep a backup before deploying; the migration script should be reviewed before running in production.
- **Frontend breakage**: Any code reading `lead.status` as a string will break. → Affected files: `src/app/admin/leads/page.tsx` (badge color check `lead.status === 'Venda'` updated to `lead.status.includes('Venda')`). Both admin and M2M API routes return `status: string[]` directly without renaming.
- **`parseImportStatus` validation**: Currently validates that status is one of the allowed strings. This function remains unchanged — it validates the *incoming* status value, not the stored array.

## Migration Plan

1. Update Prisma schema: `status String?` → `status String[] @default([])`.
2. Create migration with raw SQL: add `status_new`, backfill, drop old, rename.
3. Apply migration (`prisma migrate deploy`), regenerate client.
4. Deploy app. Restart.
5. Rollback: reverse migration restores `status` from first element of array (acceptable lossy rollback).

## Open Questions

- None. All design decisions are resolved above.
