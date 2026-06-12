# Pillar 1 — Admin

> Daily back-office: documents, tasks, notifications, templates.

## 1. Goal & User

**Primary user:** the business owner or an appointed admin assistant.
**Job to be done:** keep operations tidy day-to-day — file paperwork, run the to-do list, generate the standard business documents needed to operate legally and professionally in Malaysia.

## 2. Base Package Features

### 2.1 Digital Storage (Free 1 GB Tier)
Secure cloud repository for business documents and receipt images.

- 1 GB included on every account.
- Folder + tag organization.
- Image preview (receipts, ICs, contracts) and PDF preview.
- Upload from camera or gallery on mobile.
- File-level share links use the same secure-hash convention as invoices.

### 2.2 Smart Task Matrix
A clean, thumb-friendly **Kanban grid**: `To-Do → Doing → Done`.

- Tap-to-drag between columns (or tap card → set status).
- Optional due date + reminder.
- Assignee picker (if multi-user).
- One default board per business; future scope: multiple boards.

### 2.3 System Notification Feed
A unified alert board.

- Sources: task deadlines, invoice events, low-stock (if add-on active), leave requests (if add-on active), system messages.
- Mark-as-read, filter by source.
- Notification settings per channel (in-app, email, push) — defaults: in-app on.

### 2.4 Document Template Library (Fill-in-the-Blank)
Interactive form templates for standard Malaysian business documents.

- **Included templates (v1):**
  - Tenancy Agreement
  - Letter of Offer
  - Quotation
  - _(more to be confirmed)_
- **Mechanism:** structural layout and core boilerplate text are **locked**. Users fill **variable fields only** — e.g. Client Name, Company Address, IC Number, Dates.
- **Output:** PDF download + secure share link.
- **Why locked:** prevents accidental formatting breaks and protects legal-grade boilerplate.

### 2.5 Compliance Calendar
A pre-seeded reminder track for the recurring legal / licensing obligations that quietly bankrupt micro-SMEs when missed.

- Pre-seeded items (defaults — owner can disable any):
  - **SSM business registration renewal** (annual / 5-year).
  - **Local council signboard licence** (papan tanda) renewal.
  - **Halal certification** renewal (if applicable).
  - **Food handler / typhoid jab** certificate renewal.
  - **Premises insurance / fire insurance** policy renewal.
  - **Tenancy agreement** end date.
  - **Employer EPF / SOCSO / LHDN** monthly filing dates (informational; payroll posting handled by HR add-ons).
- Each item: due date, lead-time setting (default: notify 30 / 14 / 3 days before), notes field, "Mark Done & Schedule Next" button.
- All due-soon events flow into the **Notification Feed** (§ 2.3).
- Bulk import / CSV not in scope for v1.

### 2.6 Digital Signature on Shared Documents
Closes the loop on the Document Template Library — recipients sign on the share link directly, no print-scan-WhatsApp loop.

- When the owner generates a document (Tenancy Agreement, LO, Quotation, etc.), the secure share link includes an optional **"Sign here"** zone.
- Recipient opens the link on their phone, draws signature with finger (or types name), submits.
- Signed PDF is regenerated with the signature embedded + a timestamp + the recipient's IP (for audit).
- Signed PDF returns to the owner's Storage; original owner gets a Notification Feed event.
- Same secure-hash convention as invoices; signature can be revoked if the link is regenerated.

## 3. Marketplace Add-ons

| Add-on | Price | What it unlocks |
|--------|------:|-----------------|
| **Custom Document Builder** | +RM15/mo | Drag-and-drop visual layout editor. Owner can fully customize core text, rearrange sections, modify branding, design templates from scratch. |
| **Storage Tier 5 GB** | +RM5/mo | Replaces the 1 GB cap with 5 GB. |
| **Storage Tier 20 GB** | +RM15/mo | Replaces the cap with 20 GB. |

> Storage tiers are mutually exclusive — pick one. Custom Document Builder stacks on top of the Base Template Library; it does not remove the locked templates, it adds an editor mode.

## 4. Data Model Sketch

```
Business
 ├── files[]                  (1 GB / 5 GB / 20 GB depending on tier)
 │    ├── id, name, mime, size_bytes
 │    ├── folder_path
 │    ├── tags[]
 │    └── share_hash (nullable)
 ├── tasks[]
 │    ├── id, title, notes, status: TODO|DOING|DONE
 │    ├── due_at, assignee_user_id, reminder_at
 │    └── created_at, completed_at
 ├── notifications[]
 │    ├── id, source, payload, read_at
 │    └── created_at
 └── documents[]              (instances of filled-in templates)
      ├── id, template_id, field_values{}
      ├── pdf_file_id, share_hash
      └── created_at
```

## 5. Key User Flows

### 5.1 Generate a Quotation in under a minute
1. Owner taps **New Document → Quotation**.
2. Form opens with locked layout, empty variable fields.
3. Owner fills: client name, address, line items, total, validity.
4. Tap **Generate** → PDF rendered, saved to Storage, share link created.
5. Tap **Share via WhatsApp** → opens WA with prefilled message + link.

### 5.2 Track a daily task
1. Owner adds a card to **To-Do**.
2. When work starts, swipes card to **Doing**.
3. Marks **Done** when complete → appears in Notification Feed as a "completed" event (optional).

## 6. Open Questions

- Final list of v1 templates (which exact documents are bundled?).
- File retention policy when a user downgrades a storage tier.
- Multi-user / role permissions for tasks and storage — out of scope for v1?
- Notification push channels — email only at launch, or also FCM/web push?
- Versioning of templates — when boilerplate text changes, do old documents re-render?
