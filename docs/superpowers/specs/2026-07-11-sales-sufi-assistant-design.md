# Sales AI (Sufi) — Design

> **Status:** Approved 2026-07-11 — Sufi-only (Boardroom upgrade deferred)  
> **Add-on:** `sales-assistant` · RM 20/mo · 100 shared credits  
> **Chat:** `/sales/assistant`

---

## 1. Goals

Ship **Sufi** as Sales staff AI matching Maya/Hana: clarify → plan → act, with lead tools, POS awareness, and chase-message drafts.

**Deferred:** Boardroom Sufi→Boardroom clarifier chain (separate phase).

---

## 2. Locked decisions

| Topic | Choice |
|-------|--------|
| Persona | Floor + pipeline sales staff |
| Clarifiers | Free; smart (cheap model) with warm template fallback |
| Plans / actions | Credits (chat + action top-up like Maya) |
| Tools | Lead CRUD-ish + note + follow-up + status + assign + convert |
| Chase text | Draft in chat (copy only, no send) |
| Daily notice | Optional toggle (template, 0 LLM) |
| Boardroom | Later |

---

## 3. Data packet

- Leads: counts by status, due today, overdue (open), sample overdue/due rows, assignees  
- POS today: sales_myr, txn count, cash vs DuitNow  
- Recent sales (few rows)  
- Catalog: active product count + sample names  
- Thin-data checklist when empty  

---

## 4. Tools (after owner confirm)

- `create_lead` — name + phone required  
- `update_lead` — status, follow_up, assign, interest, lost_reason  
- `add_lead_note`  
- `convert_lead` — link/create Marketing customer by phone  

Chase WhatsApp/SMS copy is written in the reply (no tool).

---

## 5. Credits

| Step | Owner | Tokens |
|------|-------|--------|
| Smart / template clarifier | 0 | Small or 0 |
| Plan / Q&A | chat credits | Real |
| Mutating tools | + action top-up | Real |

---

## 6. Success criteria

1. Marketplace unlocks Sufi; `/sales/assistant` works when active.  
2. Planning intent → free clarifier (smart or fallback).  
3. After answers, plan uses credits; tools mutate leads after confirm.  
4. Convert uses Phase B rules (link by phone).  
5. Cashier without leads access cannot use Sufi (owner/manager/sales_rep).
