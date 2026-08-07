# Mobile responsive rollout plan

> **Scope:** Mobile PWA shell at viewport `< 768px`. Tablet (`768–1023px`) uses the desktop shell with collapsed sidebar. Wide desktop (`≥ 1024px`) unchanged.

Reference: [dual-mode architecture](../architecture/dual-mode.md).

---

## Goals

1. **Thumb-first navigation** — bottom bar only for daily high-frequency actions; full app tree in a menu drawer.
2. **No horizontal overflow** — tables, grids, and hero stats reflow or scroll intentionally on narrow screens.
3. **Safe tap targets** — `min-h-tap-min` on primary controls; bottom nav respects iOS safe area.
4. **One nav source** — `lib/navigation/app-nav.ts` feeds desktop sidebar and mobile drawer (parity with desktop).

---

## Phase 1 — Shell & navigation ✅

| Item | Status |
|------|--------|
| Shared `buildAppNavGroups()` for desktop + mobile | Done |
| Bottom bar: Home · POS · Money · Ops · Menu | Done |
| Header burger + slide-over drawer (all modules + platform) | Done |
| Remove `/more` from bottom bar (route kept for deep links) | Done |
| Safe-area padding on bottom nav + main content | Done |

**Bottom bar rationale (owner/manager default):**

| Tab | Why |
|-----|-----|
| Home | Dashboard, morning brief, quick actions |
| POS | Highest-frequency execute action (F&B / retail) |
| Money | Invoices, expenses, cash flow |
| Ops | Orders, stock, bookings |
| Menu | Admin, Marketing, HR, Sales leads, Settings, Boardroom |

---

## Phase 2 — Page responsiveness audit ✅ (P0 fixes)

P0 layout fixes shipped:

- Home: cashflow legend wrap, chart gap on narrow screens, footer stats `grid-cols-1 sm:grid-cols-3`
- POS: receipt bottom padding above tab bar; catalog toolbar stacks on mobile
- Admin storage: horizontal-scroll folder chips on mobile

Shared helpers: `lib/navigation/mobile-page.ts` (`MOBILE_PAGE_BOTTOM`, `MOBILE_PAGE_SHELL`).

Remaining P1/P2 pages can adopt the checklist incrementally:

- [ ] No unintended horizontal scroll on 375px width
- [ ] Hero stat grids: `grid-cols-2` on mobile, `sm:grid-cols-4` on larger
- [ ] Data tables: `overflow-x-auto` wrapper or card list fallback
- [ ] Forms: single column; labels above inputs
- [ ] FABs / pillar AI float: not overlapping bottom nav (`bottom-20`+ or env safe area)
- [ ] Subpage back links visible without clipping

### Priority order (traffic + pain)

| Priority | Area | Key pages | Known issues |
|----------|------|-----------|--------------|
| P0 | Home | `/home` | Done (cashflow + legend) |
| P0 | Sales | `/sales/pos`, `/sales/leads` | POS toolbar + receipt padding done |
| P0 | Finance | invoices, expenses, reports | Wide tables, month picker |
| P1 | Operations | orders, products, bookings | Kanban / tables |
| P1 | Marketing | customers, content calendar | Calendar grid → mobile list exists |
| P1 | Admin | storage file manager, compliance | Folder chips scroll done |
| P2 | HR | employees, leave | Subnav chips; staff portal |
| P2 | Settings / Marketplace | long forms, bundle cards | |
| P3 | Boardroom | meeting UI | Read-only mobile per dual-mode doc |

### Shared patterns to apply

```tsx
// Page wrapper (most module pages)
import { MOBILE_PAGE_SHELL } from "@/lib/navigation/mobile-page";
<div className={MOBILE_PAGE_SHELL}>

// Responsive stat row
<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">

// Table fallback
<div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
```

### FAB / float positioning

- Module mobile FABs: `bottom-[calc(5.5rem+env(safe-area-inset-bottom))]` (above new bottom bar)
- Pillar AI float: keep `bottom-6` on desktop; on mobile bump to `bottom-24` via `max-lg:` variant

---

## Phase 3 — Tablet (768–1023px) ✅

**Decision:** Compact **desktop** shell (sidebar, no bottom bar).

| Task | Status |
|------|--------|
| `useMode()` breakpoint → `< 768px` mobile | Done (`lib/navigation/breakpoints.ts`) |
| Sidebar collapsed-by-default on tablet | Done (`use-sidebar-collapsed.ts`) |
| Split views | Backlog (optional 2-column where desktop uses 3+) |

---

## Phase 4 — Role-aware mobile nav ✅

Per [dual-mode §8](../architecture/dual-mode.md):

| Role | Bottom bar |
|------|------------|
| Owner / Manager (+ other roles) | Home · POS · Money · Ops · Menu |
| Cashier | POS · Today · Menu |
| Staff | Tasks · Leave · Menu |
| Accountant | Money · Reports · Menu |

`role` passed from `app/(app)/layout.tsx` → `AdaptiveShell` → `MobileShell` via `getMobileBottomTabsForRole()`.

---

## Testing

1. Chrome DevTools → iPhone 14 / SE (375px)
2. Real device: iOS Safari (safe area, drawer scroll lock)
3. `npm run type-check` after nav changes
4. Smoke: open drawer → Marketing → Content; bottom POS tab; locked pillar shows upgrade
5. iPad portrait (768px): desktop shell, collapsed sidebar, no bottom bar

---

## Files

| File | Role |
|------|------|
| `lib/navigation/app-nav.ts` | Shared nav tree + role-aware bottom tabs |
| `lib/navigation/breakpoints.ts` | Mobile / tablet / desktop pixel constants |
| `lib/navigation/mobile-page.ts` | Shared mobile page padding helpers |
| `lib/navigation/use-sidebar-collapsed.ts` | Tablet default collapsed sidebar |
| `lib/use-mode.ts` | Mobile shell switch at 768px |
| `components/shells/mobile-shell.tsx` | Header, bottom bar, drawer trigger |
| `components/shells/MobileNavDrawer.tsx` | Full-page slide-over menu |
| `components/shells/desktop-shell.tsx` | Imports shared nav (no UX change) |

---

## Out of scope (mobile v1)

- Native app shells
- Offline POS queue UI changes
- Per-role tabs for marketing_officer / operations_officer (use default bar + drawer)
