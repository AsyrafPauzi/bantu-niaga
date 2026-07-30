# Cross-Module Integration Map

> **Last updated:** 2026-07-31  
> **Purpose:** Single reference for how Bantu Niaga modules connect to each other — what is **done**, **pending**, or **not planned**.  
> **Companion:** [`CHECKLIST.md`](./CHECKLIST.md) tracks feature completion per pillar; this doc tracks **edges between pillars**.

**Legend:** ✅ Done · 🟡 Pending (partial / needs deploy) · ⬜ Not done · — N/A by design

---

## Summary matrix

| From → To | Admin | Finance | Operations | Sales | Marketing | HR | Settings | Home |
|-----------|-------|---------|------------|-------|-----------|-----|----------|------|
| **Admin Storage** | ✅ Tasks, Compliance | ✅ Expense receipts | ✅ Suppliers, Orders | ✅ Leads | — Bridge link only | ✅ Employee docs | ✅ Quota tier | ✅ Snapshot |
| **Finance** | ⬜ Invoice docs | — | ⬜ PO → expense | ✅ POS → txn | ✅ Customers | — | ✅ Billing | ✅ Snapshot |
| **Operations** | ✅ File attach | ⬜ Order → expense | — | ⬜ Order → lead | — | — | — | ✅ Snapshot |
| **Sales** | ✅ Lead file | ✅ Quote → invoice | — | — | ✅ Lead → customer | — | — | ✅ Snapshot |
| **Marketing** | — Separate bucket | — | — | ✅ Convert lead | — | — | — | ✅ Snapshot |
| **HR** | ✅ Docs vault | — | — | — | — | — | ✅ Team roles | ✅ Snapshot |

---

## 1. Admin Storage (`admin_files`) — central document vault

Admin Storage is the shared back-office file vault. Other modules link via `admin_file_id` FK (same `business_id`, RLS-scoped).

### 1.1 Inbound links (who attaches files)

| Source module | Entity | Column | UI | API validation | Status |
|---------------|--------|--------|-----|----------------|--------|
| Admin · Tasks | `admin_tasks` | `admin_file_id` | Task detail modal picker | `assertAdminFileOwned` | ✅ |
| Admin · Compliance | `admin_compliance_items` | `admin_file_id` | Compliance detail upload | `assertAdminFileOwned` | ✅ |
| HR · Documents | `hr_employee_documents` | `admin_file_id` | HR form + Storage HR upload | `assertAdminFileOwned` | ✅ |
| Finance · Expenses | `finance_transactions` | `admin_file_id` | Expense list receipt attach | `resolveAdminFileIdPatch` | ✅ |
| Operations · Suppliers | `operations_suppliers` | `admin_file_id` | Supplier card attach | `resolveAdminFileIdPatch` | ✅ |
| Operations · Orders | `operations_orders` | `admin_file_id` | Order card attach | `resolveAdminFileIdPatch` | ✅ |
| Sales · Leads | `sales_leads` | `admin_file_id` | Lead detail attach | `resolveAdminFileIdPatch` | ✅ |

### 1.2 Outbound “Used by” links (Storage UI)

`loadFileUsageLinks()` in `lib/admin/storage-usage.ts` resolves reverse links shown on each file card:

| Link type | Label | Deep link |
|-----------|-------|-----------|
| `compliance` | Licence | `/admin/compliance?item=…` |
| `hr` | HR | `/hr/employees/{id}` |
| `task` | Task | `/admin/tasks?task=…` |
| `finance` | Expense | `/finance/expenses` |
| `operations_supplier` | Supplier | `/operations/suppliers` |
| `operations_order` | Order | `/operations/orders` |
| `sales_lead` | Lead | `/sales/leads/{id}` |

### 1.3 Cross-pillar file picker

| Item | Path | Status |
|------|------|--------|
| Picker API (Finance / Ops / Sales roles) | `GET /api/admin/storage/picker` | ✅ |
| Shared attach component | `components/admin/AdminStorageFileAttach.tsx` | ✅ |
| Download for cross-pillar roles | `GET /api/admin/storage/[id]/download` | ✅ |

### 1.4 Not linked to Admin Storage (by design)

| Module | Where files live | Bridge |
|--------|------------------|--------|
| Marketing | `marketing-media` bucket / `marketing_files` | Storage panel link → `/marketing/content` ✅ |
| Finance invoices | Generated PDFs, not vault rows | ⬜ Supporting docs on invoice (Phase 2) |
| HR medical certificates | Legacy HR upload path | ⬜ Optional MC → `admin_files` migration |

---

## 2. Admin internal connections

| Connection | Mechanism | Status |
|------------|-----------|--------|
| Compliance → renewal prep task | Create task from compliance item | ✅ |
| Tasks ↔ Storage | `admin_tasks.admin_file_id` | ✅ |
| Compliance ↔ Storage | Certificate PDF on licence | ✅ |
| Amir (Admin AI) reads tasks + compliance + storage gaps | `lib/ai/context/admin.ts` | ✅ |
| Amir cross-pillar KPI: expenses without receipt | Finance txn count | ✅ |
| Storage quota from plan | `businesses.tier` + `storage-10gb` add-on | ✅ |
| HR officer Storage scope | `rw_hr_docs_only` category filter | ✅ |

---

## 3. Finance ↔ other modules

| Connection | How | Status |
|------------|-----|--------|
| Expense → Storage receipt | `finance_transactions.admin_file_id` | ✅ |
| Invoice payment → ledger txn | `finance_invoice_id` on txn | ✅ |
| POS checkout → finance txn | `lib/sales/checkout.ts` | ✅ |
| Quote → invoice | Finance convert flow | ✅ |
| Customer invoices → Marketing customers | Shared `finance_customers` / marketing customers | ✅ |
| Invoice supporting PDF in Storage | — | ⬜ |
| Expense auto-create from Operations order | — | ⬜ |
| LHDN e-Invoice connector | Marketplace add-on | ⬜ |

---

## 4. Operations ↔ other modules

| Connection | How | Status |
|------------|-----|--------|
| Order → supplier | `operations_orders.supplier_id` | ✅ |
| Supplier / order → Storage doc | `admin_file_id` | ✅ |
| Product stock → POS | `operations_products` | ✅ |
| Booking → calendar | `operations_bookings` | ✅ |
| Order amount → Finance expense | — | ⬜ |
| Low stock → Amir / Aiman alert | Partial via AI context | 🟡 |

---

## 5. Sales ↔ other modules

| Connection | How | Status |
|------------|-----|--------|
| Lead → Storage proposal | `sales_leads.admin_file_id` | ✅ |
| Lead won → Marketing customer | `POST /api/sales/leads/[id]/convert` | ✅ |
| Lead → POS | Link from lead detail | ✅ |
| Quote document | Via Finance quotes (not Storage on lead) | 🟡 |
| POS → Finance txn | Checkout pipeline | ✅ |

---

## 6. Marketing ↔ other modules

| Connection | How | Status |
|------------|-----|--------|
| Content media bucket | Separate from `admin_files` | — |
| Storage → Marketing bridge copy | Admin Storage panel | ✅ |
| Lead convert → customer | Sales → `/marketing/customers/{id}` | ✅ |
| Broadcast → customer segments | Marketing core | ✅ |
| Campaign asset in Admin Storage | Not planned | — |

---

## 7. HR ↔ other modules

| Connection | How | Status |
|------------|-----|--------|
| Employee document → Storage | `hr_employee_documents.admin_file_id` | ✅ |
| Upload from Storage (HR category) | Staff picker + doc type | ✅ |
| Profile completion gaps | IC / bank / contract flags | ✅ |
| Leave → Operations bookings | — | ⬜ |
| Payroll → Finance | Marketplace add-on | ⬜ |

---

## 8. Settings & platform (cross-cutting)

| Connection | How | Status |
|------------|-----|--------|
| Plan tier → Storage quota | `lib/admin/storage-quota.ts` | ✅ |
| Team RBAC → all modules | `lib/permissions.ts` | ✅ |
| Marketplace add-ons → module unlock | Plan gating | ✅ |
| Audit log → Amir context | `audit_log` recent rows | ✅ |
| Home dashboard snapshots | `lib/home/load-snapshot.ts` | ✅ |
| PDPA export includes all pillars | `lib/privacy/export-bundle.ts` | ✅ |

---

## 9. AI assistants (cross-pillar awareness)

| Agent | Pillar | Reads other modules | Status |
|-------|--------|---------------------|--------|
| Amir | Admin | Compliance, Storage, Finance receipt gaps | ✅ |
| Fayza | Finance | Invoices, transactions | ✅ |
| Aiman | Operations | Orders, stock, bookings | ✅ |
| Maya | Marketing | Content, customers | ✅ |
| Hana | HR | Employees, leave | ✅ |
| Boardroom | All | Pillar snapshots | ✅ |

---

## 10. Migrations reference

| Migration | Purpose |
|-----------|---------|
| `20260730161220_admin_files_tags.sql` | Storage tags |
| `20260730162942_admin_tasks_file_attachment.sql` | Tasks ↔ Storage |
| `20260730280000_cross_pillar_admin_file_links.sql` | Finance, Ops, Sales ↔ Storage |

Apply on remote: `npx supabase db push`

---

## 11. Planned next (Option D remainder)

| Phase | Item | Status |
|-------|------|--------|
| Finance 1b | Invoice supporting docs in Storage | ⬜ |
| Operations | Product spec sheet → Storage | ⬜ |
| Sales | Quote PDF via Finance link on lead | 🟡 |
| HR | MC documents → `admin_files` | ⬜ |
| Polish | Deep links from Storage to exact expense row | ⬜ |

---

*Update this file whenever a new cross-module FK, API, or UI bridge ships.*
