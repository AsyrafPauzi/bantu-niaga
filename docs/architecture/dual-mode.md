# Dual-Mode Architecture — Desktop ERP + Mobile PWA

> BantuNiaga is a **dual-mode SaaS system**. The same data, the same accounts, the same business — but **two distinct interfaces** tuned to two distinct jobs.

```
┌─────────────────────────────────────────────────────────────────┐
│                  🖥️  DESKTOP ERP (CONTROL CENTER)                │
│                                                                  │
│   Deep management · Analytics · Reporting · Configuration       │
│   Used by: Owner, Manager, HR Officer, Accountant               │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                  📱  MOBILE PWA (EXECUTION ENGINE)               │
│                                                                  │
│   Speed · Camera · WhatsApp · Sub-10-second actions             │
│   Used by: Owner (on the go), Cashier, Staff, HR Officer        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

                Both share one PostgreSQL backbone.
                Both share one auth & RBAC layer.
                Both share one event bus & cross-pillar sync.
```

This split is not a "responsive design" — it's a deliberate **product architecture decision**.

---

## 1. The Core Insight

Micro-SME owners do **two completely different jobs** across the day:

| Job | Where | How long | Frequency |
|-----|-------|----------|-----------|
| **Execute** — ring a sale, log an expense, ship an order, mark a task done | Behind the counter, on the road | < 10 seconds | Dozens of times per day |
| **Control** — analyze last month's P&L, review HR salaries, configure templates, run AI Boardroom | At a desk, in the evening | 5–30 minutes | Once a day or once a week |

A single UI cannot serve both. So we split:

- **Mobile PWA** is optimized for the Execute job. Speed is the only KPI that matters.
- **Desktop ERP** is optimized for the Control job. Density and depth matter more than speed.

---

## 2. Mobile PWA — The Execution Engine

### Form factor
- Progressive Web App. Installable from the browser to home screen — no app store gatekeepers, no native distribution overhead.
- Renders at 375 px width as the primary target; scales gracefully up.
- Bottom navigation in TikTok / Shopee style (thumb-reachable; familiar to the target user).

### What lives here
The 5–10 actions a business does dozens of times per day:

| Surface | Function |
|---------|----------|
| Home dashboard | Today's snapshot · AI Morning Brief · 3 quick-action tiles |
| Quick POS Sales | Tap-grid checkout · Cash / DuitNow Static QR · <5s ring-up |
| Invoice Sharing | Generate secure URL → Share via WhatsApp in two taps |
| Expense Capture | Camera-first: snap receipt → auto-fill → save |
| Task Quick Board | Kanban swipe: TODO → DOING → DONE |
| AI Morning Brief | Daily 3-item briefing per subscribed Agent |
| Stock Quick Update | One-tap +/- to physical inventory |
| Booking Quick Confirm | One-tap accept/decline for incoming reservations |
| Leave Approve / Reject | Notification swipe → instant decision |

### Performance bar
| Metric | Target |
|--------|-------:|
| First Contentful Paint (mid-Android, 4G) | < 2s |
| Hot-path actions (POS sale, mark-paid, task tick) | **< 5s end-to-end** |
| General mobile execution actions | **< 10s end-to-end** |
| Camera-to-saved-expense | < 8s |

### PWA capabilities used
- **Add to home screen** — looks like a native app.
- **Service worker** — caches the app shell for instant launch.
- **IndexedDB** — for the offline POS queue when the Hardware & POS Extensions add-on is active.
- **Push notifications** — Web Push for AI briefings, low-stock alerts, leave requests.
- **Camera API** — receipt and MC capture.
- **Web Share API** — native share sheet integration for WhatsApp.

---

## 3. Desktop ERP — The Control Center

### Form factor
- Standard Next.js web app at desktop viewport (≥ 1024 px).
- Multi-pane layouts: sidebar nav + content + contextual right panel.
- Dense data tables, multi-chart dashboards, side-by-side analytics.

### What lives here
The deep, infrequent, decision-heavy workflows:

| Surface | Function |
|---------|----------|
| Finance Dashboard | Full P&L · Balance Sheet (add-on) · Reconciliations · Cashflow charts |
| HR Management System | Employee roster · Salary configuration · Payroll runs · Statutory deductions |
| Operations Control Panel | Multi-resource booking calendar · Supplier cost reports · Product catalog editor |
| Sales CRM Dashboard | Pipeline-wide analytics · Lead aging · Conversion funnel |
| Marketing Analytics Hub | Customer cohorts · UTM analytics (add-on) · Campaign ROI |
| Compliance Center | LHDN export (add-on) · EPF / SOCSO / EIS configuration · audit trail viewer |
| **AI Boardroom Console** | Multi-Agent orchestrated query interface · saved Boardroom history |
| Template Editor | Custom Document Builder (add-on) — drag-and-drop layout editor |
| Marketplace Settings | Add-on activation · AI Agent subscription · billing |
| User & Role Management | Invite staff · assign roles · revoke access · activity log |

### Why desktop for Boardroom
The Boardroom returns 4–6 structured Agent perspectives + a synthesis block. That's a *reading & comparison* task — perfectly suited to a wide screen, poorly suited to a 6-inch phone.

### Performance bar
| Metric | Target |
|--------|-------:|
| First Contentful Paint | < 1.5s |
| Dashboard chart hydration | < 3s |
| Heavy report generation (P&L, LHDN XML) | < 10s in foreground, queued if longer |

---

## 4. What Lives in Both (and Where the Truth Sits)

| Capability | Mobile PWA | Desktop ERP |
|------------|:----------:|:-----------:|
| Log an expense | ✅ (camera-first, primary surface) | ✅ (form-based, secondary) |
| Generate an invoice | ✅ (primary — WhatsApp-share) | ✅ (with line-item editor for complex invoices) |
| Mark invoice paid | ✅ | ✅ |
| Add a customer | ✅ (via POS or quick-add) | ✅ (full CRM card editor) |
| View a customer profile | ⚠️ (summary only) | ✅ (full history, all linked records) |
| Add a product to catalog | ⚠️ (basic fields) | ✅ (variants, groups, images, suppliers) |
| Take a POS sale | ✅ **(only here)** | ❌ |
| Approve / reject leave | ✅ (swipe) | ✅ (with context) |
| Run payroll batch | ❌ | ✅ **(only here)** |
| Generate LHDN XML export | ❌ | ✅ **(only here)** |
| Edit a document template | ❌ | ✅ **(only here)** |
| Open the Executive Boardroom | ⚠️ (mobile-friendly read-only view) | ✅ **(primary surface)** |
| Configure roles & permissions | ❌ | ✅ **(only here)** |
| View deep analytics / P&L | ❌ | ✅ **(only here)** |

**Both modes write to the same PostgreSQL multi-tenant DB through the same API.** There is no separate sync layer to fail. Mobile and desktop are simply two clients of one backend.

---

## 5. Role × Mode Matrix

Combining the 6 user roles with the 2 modes:

| Role | Primary mode | Secondary mode | Locked out of |
|------|--------------|----------------|---------------|
| **Owner** | Both equally | — | Nothing |
| **Manager** | Both | — | Billing & role assignment (Owner only) |
| **Accountant** | Desktop (primary) | Mobile (limited) | All pillars except Finance |
| **HR Officer** | Both | — | All pillars except HR + Admin (storage for HR docs) |
| **Cashier** | **Mobile only** | — | Everything except POS surface |
| **Staff** | Mobile only | — | Everything except assigned task board + self-service leave |

Implementation note: each user gets one `role` field, and the API layer + UI shell respect role-based permissions for every endpoint and view. See [tech-stack.md](./tech-stack.md) §8.

---

## 6. Shared Backbone

Despite the dual-mode UI split, the system is one product:

```
┌─────────────────┐    ┌─────────────────┐
│  Desktop ERP    │    │  Mobile PWA     │
│  (Next.js web)  │    │  (Next.js PWA)  │
└────────┬────────┘    └────────┬────────┘
         │                       │
         │ HTTPS (same API)      │
         └───────────┬───────────┘
                     │
            ┌────────▼────────┐
            │  Next.js API +  │
            │  Edge Functions │
            └────────┬────────┘
                     │
            ┌────────▼────────┐
            │   PostgreSQL    │
            │   (multi-tenant)│
            └─────────────────┘
```

Same:
- Authentication
- Authorization (RBAC)
- Multi-tenancy (per `business_id`)
- Cross-pillar sync events (see [cross-pillar-sync.md](./cross-pillar-sync.md))
- AI orchestration (see [../ai/agents.md](../ai/agents.md))
- Billing & subscriptions

Different:
- UI shell (component library variants for mobile vs desktop)
- Information density per screen
- Default navigation pattern
- Available surfaces per role × mode (the matrix above)

---

## 7. Why PWA Instead of Native iOS/Android (v1)

| Reason | Detail |
|--------|--------|
| **Distribution speed** | No app store review cycles. Push fixes the same day. |
| **Zero install friction** | "Open the link, tap Add to Home Screen" — no Play Store login required. |
| **One codebase** | Next.js renders both desktop and PWA from the same component tree. |
| **Cost discipline** | No dual native team needed for v1 — feeds the >95% gross margin model. |
| **Web-first hot paths still hit < 5s** | The 5-second rule is achievable on PWA with service worker caching + optimistic UI. |

Native iOS/Android apps are explicitly **post-v1 scope** (see [PRD.md §15](../PRD.md)). When they ship, they'll wrap the same backend — no migration for users.

---

## 8. Mobile UX Patterns

### Bottom navigation (TikTok / Shopee style)
Five tabs maximum, always thumb-reachable:

```
┌─────────────────────────────────────┐
│                                     │
│           CONTENT AREA              │
│                                     │
├─────────────────────────────────────┤
│  🏠     📋      💰      📊     ⚙️   │
│ Home  Tasks  Money  Reports  Set   │
└─────────────────────────────────────┘
```

Exact tab labels are role-dependent. Cashier sees: `POS · Today · Customers · Inventory · More`. Staff sees: `Tasks · Schedule · Leave · Profile · More`.

### Camera-first inputs
The single most repeated action — logging an expense — opens to the camera, not to a form. The form fills in *after* the photo.

### WhatsApp-native CTAs
Every shareable artifact has **"Share via WhatsApp"** as the primary button. The message body is pre-drafted; the link uses the secure-hash URL system. The user taps once; WhatsApp does the rest.

### Quick Actions tile
The home screen reserves the top third for **3 quick-action tiles** chosen per role:
- Owner: `Record Sale · Create Invoice · Log Expense`
- Cashier: `New Sale · Hold Order · Day-End Close`
- Staff: `Punch In · Submit Leave · My Tasks`

---

## 9. Desktop UX Patterns

### Dashboard density
- 4-pane grid: KPI cards top · primary chart left · secondary breakdown right · drill-down table bottom.
- Persistent left sidebar for pillar navigation.
- Contextual right panel for any selected row's detail.

### Boardroom Console
- Multi-line prompt input top-of-screen.
- Each Agent's response renders as a card in a horizontal scroll lane.
- Synthesis block fixed at the bottom.
- Saved-runs history accessible from a left rail.

### Compliance & Reports
- Heavy reports run in the background; user gets a notification when ready (Desktop + Mobile notification).
- LHDN XML export shows a preview with mapped fields before generating the final file.

---

## 10. Open Questions

- Should the PWA show a deliberate "open this on desktop for full control" hint when a mobile user lands on a desktop-only feature?
- For roles that use both modes (Owner, Manager, HR Officer), should we sync UI state across devices (e.g. continue where you left off)?
- How aggressive should the desktop ERP's auto-refresh be (real-time WebSocket vs. 30s polling)?
- Should we offer a tablet-optimized layout, or treat tablets as small desktops?
- Mobile push notifications via Web Push — what's the opt-in copy and timing?
