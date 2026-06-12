# Pillar 4 — Marketing

> Reach customers and keep coming back to them.

## 1. Goal & User

**Primary user:** the owner or a junior marketing helper.
**Job to be done:** know who the customers are, plan what to post, run promos, and trace which channel actually drives traffic.

## 2. Base Package Features

### 2.1 Customer Profiles CRM
A card-index customer log.

- Each customer card:
  - **Essential contact:** name, phone (WhatsApp), email, address.
  - **Historical purchase metrics:** total spend, last purchase date, order count, avg order value.
  - Tags (e.g. `vip`, `kedai-runcit`, `online-only`) — both manual tags and auto-tags (see below).
  - Notes / interaction history.
- Customers are referenced by Operations (orders, bookings), Sales (POS), Finance (invoices).
- **Phone-based dedup (canonical rule).** When a `customer.created` event fires from any pillar (POS, booking, lead conversion, CSV import), the system matches by **normalized phone number** (Malaysia format). On exact match → auto-merge into the existing record. On phone match but different name → present a "Looks like the same customer — merge?" prompt to the owner. No phone → no auto-merge; the record is created fresh.
- **Auto Customer Segmentation Tags.** Computed nightly from the existing CRM fields (zero AI cost — pure threshold rules). Five segments shipped in v1:
  - `new` — first purchase < 30 days ago.
  - `repeat` — ≥ 2 orders.
  - `vip` — total_spend ≥ RM 1,000 OR order_count ≥ 10. Hard-coded in v1; per-business override is a v2 add-on (locked in `docs/plans/marketing-decisions.md` Q1).
  - `dormant` — last_purchase_at > 90 days ago.
  - `at-risk` — was `repeat` or `vip` and has now slipped past 60 days without purchase.
  Auto-tags are visually distinct from manual tags and feed downstream Promo / WA Broadcast targeting.
- **Customer CSV Import + Export** — bulk onboarding for businesses migrating from Excel / WhatsApp lists. Import maps columns to fields; previews dedup matches before commit; rejects rows with missing phones. Export downloads a CSV of the current customer set including auto-tags.

### 2.2 Social Media Content Calendar
A timeline planner for marketing hooks.

- Channels covered: **TikTok**, **Instagram**, **Facebook**.
- Plan posts on a calendar view (day / week / month).
- Each entry: channel, scheduled date+time, caption draft, hook/idea, attached media file (uses Admin Storage).
- Status: `Idea → Drafted → Scheduled → Posted`.
- v1 is **planning-only** — does not auto-post to platforms (out of scope until API integrations are confirmed).

## 3. Marketplace Add-ons

| Add-on | Price | What it unlocks |
|--------|------:|-----------------|
| **Smart Link Tracker (UTM)** | +RM15/mo | Generates custom URL parameters (UTM links) to trace traffic origin. Lets the owner compare e.g. **TikTok bio link** vs **paid Facebook campaign**. |
| **Promo Engine & WhatsApp Script Templates** | +RM20/mo | Generates campaign discounts and converts them into **high-converting WhatsApp script templates** ready to copy-paste. |

## 4. Data Model Sketch

```
Business
 ├── customers[]
 │    ├── id, name, phone, email, address
 │    ├── tags[], notes
 │    ├── derived: total_spend, last_purchase_at, order_count, aov
 │    └── created_at
 ├── content_plan[]
 │    ├── id, channel: TIKTOK|INSTAGRAM|FACEBOOK
 │    ├── status: IDEA|DRAFTED|SCHEDULED|POSTED
 │    ├── scheduled_at, caption, hook
 │    └── media_file_ids[]
 ├── utm_links[]                  (add-on)
 │    ├── id, label, base_url, source, medium, campaign
 │    ├── generated_url
 │    └── click_count (if we self-host the redirect)
 └── promos[]                     (add-on)
      ├── id, name, discount_type: PCT|AMOUNT, value
      ├── valid_from, valid_to
      └── wa_template_text
```

## 5. Key User Flows

### 5.1 Add a new customer from a walk-in
1. POS (Sales) → at checkout, tap **+ Customer** → enter phone.
2. If new, fill name; if existing, system matches by phone.
3. After sale, customer's `total_spend` and `last_purchase_at` update automatically.

### 5.2 Plan a week of TikTok posts
1. Marketing → Calendar → week view.
2. Tap a day slot → pick **TikTok** → write hook + caption → attach video file from Storage.
3. Set status **Scheduled** with a reminder time.
4. When owner posts manually, mark **Posted**.

### 5.3 Run a UTM-tagged campaign (add-on)
1. Marketing → Smart Link Tracker → **+ New Link**.
2. Pick base URL (e.g. menu page), set source=`tiktok`, medium=`bio`, campaign=`raya2026`.
3. Copy generated URL into TikTok bio.
4. Open dashboard later to see click counts per source/campaign.

### 5.4 Launch a WhatsApp promo (add-on)
1. Marketing → Promo Engine → **+ New Promo** (e.g. `15% OFF`).
2. System generates a WA script with the discount baked in.
3. Owner copies it and pastes into WhatsApp broadcast / status.

## 6. Open Questions

- Do we ingest order/invoice events into the CRM in real time, or via a nightly aggregate? _(Real-time for purchase metrics; segmentation tags refreshed nightly.)_
- Click tracking for UTM — do we self-host a redirect (`bantuniaga.com/r/[hash]`), or rely on the platforms' built-in analytics? _(Smart Link Tracker add-on scope.)_
- Are WhatsApp Business API integrations in scope later (so promos can be sent without copy-paste)? _(Future add-on: WA Broadcast Manager.)_
> Resolved (now in core, v2026-06-12): Customer dedup rule (by phone) · Auto customer segmentation tags · Bulk CSV import + export.
> Resolved (decisions locked, v2026-06-12): Auto-tag thresholds hard-coded in v1, per-business override is v2 add-on. Real-time purchase metrics + nightly tag refresh confirmed. See `docs/plans/marketing-decisions.md` for the full 12 locked decisions.
