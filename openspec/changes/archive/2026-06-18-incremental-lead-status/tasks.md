## 1. Database Migration

- [x] 1.1 Update `prisma/schema.prisma`: change `status String?` to `status String[] @default([])`
- [x] 1.2 Generate migration skeleton: `npx prisma migrate dev --name incremental-lead-status --create-only`
- [x] 1.3 Replace generated migration SQL with the safe column swap:
  ```sql
  ALTER TABLE "Customer" ADD COLUMN "status_new" TEXT[] NOT NULL DEFAULT '{}';
  UPDATE "Customer" SET "status_new" = ARRAY["status"] WHERE "status" IS NOT NULL;
  ALTER TABLE "Customer" DROP COLUMN "status";
  ALTER TABLE "Customer" RENAME COLUMN "status_new" TO "status";
  ```
- [x] 1.4 Apply migration: `npx prisma migrate dev`
- [x] 1.5 Regenerate Prisma client: `npx prisma generate`

## 2. Import Route

- [x] 2.1 In `src/app/api/admin/import-results/route.ts`, update the customer update block: check if `customer.status` already includes the incoming `status` value; only append with `{ status: { push: status } }` if not already present (the `findMany` result already includes all fields so `customer.status` is available)

## 3. Leads Listing API

- [x] 3.1 In `src/app/api/leads/route.ts`, update the `statusFilter` type annotation: replace `{ status: null } | { status: string }` with `{ status: { isEmpty: true } } | { status: { has: string } }`
- [x] 3.2 Update `statusFilter` construction: map `"Not Qualified"` to `{ status: { isEmpty: true } }` and other values to `{ status: { has: s } }`
- [x] 3.3 `status` field passes through as `string[]` in the response — no rename needed (kept as `status` for API compatibility)

## 4. Leads Summary API

- [x] 4.1 In `src/app/api/leads/summary/route.ts`, update the raw SQL: replace `status = 'Proposta'` with `status @> ARRAY['Proposta']` and `status = 'Venda'` with `status @> ARRAY['Venda']`

## 5. Frontend — Leads Page

- [x] 5.1 In `src/app/admin/leads/page.tsx`, update the `Lead` type: change `status: string | null` to `status: string[]`
- [x] 5.2 Update `leadStatus` derivation: maps empty `status` array to `"Not Qualified"`; `"Venda"` if present, else `"Proposta"`
- [x] 5.3 Update status filter match: for `"Not Qualified"` check `lead.status.length === 0`; for other values check `lead.status.includes(s)`
- [x] 5.4 Update CSV export status cell: `lead.status.length > 0 ? lead.status.join(" / ") : "Não qualificado"`
- [x] 5.5 Update badge visibility guard: `lead.status.length > 0`
- [x] 5.6 Update badge color: `lead.status.includes('Venda')`
- [x] 5.7 Update badge text: `lead.status.join(' / ')`

## 6. Tests — Import Route (`__tests__/import.test.ts`)

- [x] 6.1 Add `status: []` to all `mockFindMany` return values that return a customer object (so the dedup check has an array to check against)
- [x] 6.2 Update the `update` assertion: change `data: expect.objectContaining({ status: "Venda", ... })` to `data: expect.objectContaining({ status: { push: "Venda" }, ... })`
- [x] 6.3 Add test: "does not re-append existing status milestone" — mock customer with `status: ["Venda"]`, import `"Venda"`, assert update data has no `status: { push: "Venda" }`

## 7. Tests — Public Leads API (`__tests__/public-leads-route.test.ts`)

- [x] 7.1 Update `SAMPLE_LEAD` fixture: change `status: null` to `status: []`
- [x] 7.2 Update "maps Not Qualified status" test: expected filter `{ OR: [{ status: { isEmpty: true } }] }`
- [x] 7.3 Update "combines multiple status values" test: expected filter `{ OR: [{ status: { has: "Proposta" } }, { status: { has: "Venda" } }] }`
- [x] 7.4 Update response shape test: assert `lead.status` is `string[]` (array), `lead.status` equals `[]`

## 8. API Docs (`docs/api.yaml`)

- [x] 8.1 Update `Lead` schema: change `status` type from `[string, "null"]` with string enum to `type: array, items: { type: string, enum: [Proposta, Venda] }`. Remove `"null"` from enum. Update description to reflect array semantics (empty array = Not Qualified).
- [x] 8.2 Update status filter query param description: change `` `Not Qualified` matches leads with no status assigned (null in DB) `` to `` `Not Qualified` matches leads with an empty status array ``
- [x] 8.3 Update the inline response example: change `status: "Proposta"` to `status: ["Proposta"]`
- [x] 8.4 Update `proposals` and `sales` field descriptions in `LeadsSummaryGroup` schema: clarify counts include leads that have ever reached the milestone (a lead with both statuses is counted in both)
