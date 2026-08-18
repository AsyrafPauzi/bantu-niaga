# NiagaX Transactional Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One NiagaX HTML email (teal/paper, EN or MS) for Auth and app mail, sent only through Resend via a verified Send Email hook plus existing invoice/broadcast/digest paths.

**Architecture:** Pure HTML renderer in `lib/email/`. Auth events hit `POST /api/webhooks/auth-send-email` (Standard Webhooks secret, no session). Locale comes from `public.users.preferred_locale` (`en` default). Invoices, broadcasts, and the Boardroom digest call the same renderer. Do not add `standardwebhooks` or React Email — HMAC verify with Node `crypto`.

**Tech Stack:** Next.js 15 App Router, Vitest, Zod, Resend HTTP (`lib/marketing/email-resend.ts`), Supabase Auth Send Email Hook, Postgres check constraint.

**Spec:** `docs/superpowers/specs/2026-08-19-niagax-transactional-email-design.md`

## Global Constraints

- Locales are only `en` and `ms`. Unknown or missing user row → `en`.
- Escape all interpolated strings in HTML (names, subjects, URLs in attributes).
- Never put `AUTH_SEND_EMAIL_HOOK_SECRET`, Resend keys, or stack traces in HTTP bodies.
- Hook route stays under `/api/webhooks/` so middleware does not require a session.
- CTA URL for Auth is `{NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify?token={token_hash}&type={email_action_type}&redirect_to={redirect_to}` built with `URLSearchParams`.
- Colors: page `#EEF2F6`, header/button `#0E7490`, body text `#0B1220`, footer `#6b7280`. No `linear-gradient`. No `#6d28d9`.
- From: `NiagaX <addr>` when `MARKETING_FROM_EMAIL` is a bare address; leave unchanged if it already contains `<`.
- Invitees / new signups without a `public.users` row: English. Not the inviter’s language.
- Do not translate the rest of the app UI.
- Tests stub Resend (`vi.fn` on `sendEmail`); never call the live API in CI.
- Commits only when the user asks, unless they chose an execution mode that includes commits.

## File map

| File | Role |
|------|------|
| `lib/email/types.ts` | `EmailLocale`, layout input |
| `lib/email/layout.ts` | `escapeHtml`, `renderNiagaXEmail` |
| `lib/email/copy.ts` | EN/MS Auth + footer strings |
| `lib/email/auth-mail.ts` | Verify URL, map action type → mail fields |
| `lib/email/from.ts` | `formatPlatformFrom` |
| `lib/email/hook-secret.ts` | Standard Webhooks verify |
| `lib/email/resolve-locale.ts` | Load `preferred_locale` via service role |
| `app/api/webhooks/auth-send-email/route.ts` | Hook handler |
| `supabase/migrations/20260819120000_user_preferred_locale.sql` | Column |
| `lib/settings/schemas.ts` | `preferred_locale` on profile schema |
| `app/api/settings/profile/route.ts` | GET + PATCH locale |
| `app/(app)/settings/appearance/page.tsx` + language card | UI |
| `lib/marketing/email-broadcast-template.ts` | Use shared layout |
| `app/api/finance/invoices/[id]/send/route.ts` | HTML body |
| `app/api/cron/boardroom-weekly-digest/route.ts` + `lib/privacy/platform-email.ts` | HTML digest |
| `docs/DEPLOY-SMTP.md` + `lib/env/production-checks.ts` | Operator + env check |
| Tests under `tests/email/` and existing profile/broadcast tests |

---

### Task 1: HTML layout + escapeHtml

**Files:**
- Create: `lib/email/types.ts`
- Create: `lib/email/layout.ts`
- Test: `tests/email/layout.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `export type EmailLocale = "en" | "ms"`
  - `export type NiagaXEmailInput = { locale: EmailLocale; brandName: string; subject: string; heading: string; bodyText: string; ctaLabel?: string; ctaHref?: string; footerText: string; previewText?: string }`
  - `export function escapeHtml(text: string): string`
  - `export function renderNiagaXEmail(input: NiagaXEmailInput): string`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { escapeHtml, renderNiagaXEmail } from "@/lib/email/layout";

describe("renderNiagaXEmail", () => {
  it("escapes brand, subject, heading, body, and href", () => {
    const html = renderNiagaXEmail({
      locale: "en",
      brandName: 'Cafe <script> & Co',
      subject: "Hi <b>",
      heading: "Reset <img>",
      bodyText: "Hello <b>world</b>",
      ctaLabel: "Go",
      ctaHref: "https://example.test/?next=\"evil\"",
      footerText: "Bantu Niaga Sdn. Bhd.",
    });
    expect(html).toContain("Cafe &lt;script&gt; &amp; Co");
    expect(html).toContain("Hello &lt;b&gt;world&lt;/b&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("#0E7490");
    expect(html).toContain("#EEF2F6");
    expect(html).not.toContain("linear-gradient");
    expect(html).not.toContain("#6d28d9");
    expect(html).toContain("href=\"https://example.test/?next=&quot;evil&quot;\"");
  });

  it("omits the button when ctaHref is missing", () => {
    const html = renderNiagaXEmail({
      locale: "en",
      brandName: "NiagaX",
      subject: "Code",
      heading: "Confirm",
      bodyText: "Your code is 123456",
      footerText: "Footer",
    });
    expect(html).not.toContain("<a ");
  });
});

describe("escapeHtml", () => {
  it("escapes quotes", () => {
    expect(escapeHtml('"hi"')).toBe("&quot;hi&quot;");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/email/layout.test.ts`

Expected: FAIL — cannot find module `@/lib/email/layout`

- [ ] **Step 3: Write minimal implementation**

`lib/email/types.ts`:

```ts
export type EmailLocale = "en" | "ms";

export type NiagaXEmailInput = {
  locale: EmailLocale;
  brandName: string;
  subject: string;
  heading: string;
  bodyText: string;
  ctaLabel?: string;
  ctaHref?: string;
  footerText: string;
  previewText?: string;
};
```

`lib/email/layout.ts`: table email, 560px card, colors from Global Constraints. `escapeHtml` for `& < > "`. Convert `bodyText` newlines to `<br />` after escaping. Optional CTA `<a>` only when `ctaHref` is a non-empty string. `lang` attribute on `<html>` is `en` or `ms` from `input.locale`.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run tests/email/layout.test.ts`

Expected: PASS

- [ ] **Step 5: Commit** (only if the user asked to commit)

```bash
git add lib/email/types.ts lib/email/layout.ts tests/email/layout.test.ts
git commit -m "feat(email): add NiagaX HTML layout and HTML escaping"
```

---

### Task 2: Auth copy, verify URL, from-header

**Files:**
- Create: `lib/email/copy.ts`
- Create: `lib/email/auth-mail.ts`
- Create: `lib/email/from.ts`
- Test: `tests/email/auth-mail.test.ts`

**Interfaces:**
- Consumes: `EmailLocale` from Task 1; `renderNiagaXEmail` not required here
- Produces:
  - `export type AuthEmailAction = string`
  - `export function authEmailCopy(action: string, locale: EmailLocale, vars: { businessName?: string; inviterName?: string }): { subject: string; heading: string; bodyText: string; ctaLabel: string; footerText: string }`
  - `export function buildAuthVerifyUrl(opts: { supabaseUrl: string; tokenHash: string; emailActionType: string; redirectTo: string }): string`
  - `export function formatPlatformFrom(fromEmail: string): string`

Copy table (use these strings verbatim):

| action | locale | subject | heading | body | button |
|--------|--------|---------|---------|------|--------|
| signup | en | Confirm your NiagaX email | Confirm your email | Confirm your email to finish setting up NiagaX. | Confirm email |
| signup | ms | Sahkan e-mel NiagaX anda | Sahkan e-mel anda | Sahkan e-mel anda untuk selesai sediakan NiagaX. | Sahkan e-mel |
| recovery | en | Reset your NiagaX password | Set a new password | We got a request to reset your password. If this wasn’t you, ignore this email. | Set new password |
| recovery | ms | Tetapkan semula kata laluan NiagaX | Tetapkan kata laluan baharu | Kami menerima permintaan tetapkan semula kata laluan. Jika ini bukan anda, abaikan e-mel ini. | Tetapkan kata laluan |
| invite | en | You’re invited to {business} on NiagaX | Join the team | {inviter} invited you to {business} on NiagaX. | Join team |
| invite | ms | Anda dijemput ke {business} di NiagaX | Sertai pasukan | {inviter} menjemput anda ke {business} di NiagaX. | Sertai pasukan |
| magiclink | en | Your NiagaX sign-in link | Sign in to NiagaX | Use this link to sign in. It works once. | Sign in |
| magiclink | ms | Pautan log masuk NiagaX anda | Log masuk ke NiagaX | Gunakan pautan ini untuk log masuk. Ia sah sekali sahaja. | Log masuk |
| email_change | en | Confirm your new NiagaX email | Confirm your new email | Confirm this address to finish changing your email. | Confirm email |
| email_change | ms | Sahkan e-mel NiagaX baharu anda | Sahkan e-mel baharu | Sahkan alamat ini untuk selesai tukar e-mel. | Sahkan e-mel |
| reauthentication | en | Confirm it’s you | Confirm it’s you | Confirm this action on your NiagaX account. | Confirm |
| reauthentication | ms | Sahkan ini anda | Sahkan ini anda | Sahkan tindakan ini pada akaun NiagaX anda. | Sahkan |

Unknown action → English: subject/heading/button `Continue in NiagaX`, body `Open NiagaX to continue.`

Footer EN: `You received this because of an account action on NiagaX. Links expire in about 1 hour. Bantu Niaga Sdn. Bhd.`  
Footer MS: `Anda menerima e-mel ini kerana tindakan akaun di NiagaX. Pautan tamat dalam kira-kira 1 jam. Bantu Niaga Sdn. Bhd.`

`{business}` default `"a workspace"` / `"ruang kerja"` if missing. `{inviter}` default `"A teammate"` / `"Rakan sepasukan"`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { authEmailCopy, buildAuthVerifyUrl } from "@/lib/email/auth-mail";
import { formatPlatformFrom } from "@/lib/email/from";

describe("authEmailCopy", () => {
  it("returns English recovery copy", () => {
    const c = authEmailCopy("recovery", "en", {});
    expect(c.heading).toBe("Set a new password");
    expect(c.ctaLabel).toBe("Set new password");
  });

  it("returns Malay signup copy", () => {
    const c = authEmailCopy("signup", "ms", {});
    expect(c.heading).toBe("Sahkan e-mel anda");
  });

  it("falls back to English generic for unknown actions", () => {
    const c = authEmailCopy("not_a_real_type", "ms", {});
    expect(c.subject).toBe("Continue in NiagaX");
  });
});

describe("buildAuthVerifyUrl", () => {
  it("puts token_hash in the token query param", () => {
    const url = buildAuthVerifyUrl({
      supabaseUrl: "https://abc.supabase.co/",
      tokenHash: "hash123",
      emailActionType: "recovery",
      redirectTo: "https://app.niagax.my/auth/callback?next=/reset-password",
    });
    expect(url.startsWith("https://abc.supabase.co/auth/v1/verify?")).toBe(true);
    expect(url).toContain("token=hash123");
    expect(url).toContain("type=recovery");
    expect(url).toContain("redirect_to=");
  });
});

describe("formatPlatformFrom", () => {
  it("wraps a bare address", () => {
    expect(formatPlatformFrom("noreply@app.niagax.my")).toBe(
      "NiagaX <noreply@app.niagax.my>",
    );
  });

  it("keeps an existing display name", () => {
    expect(formatPlatformFrom("NiagaX <noreply@app.niagax.my>")).toBe(
      "NiagaX <noreply@app.niagax.my>",
    );
  });
});
```

Keep `authEmailCopy` in `copy.ts` and re-export from `auth-mail.ts` (or import copy from tests). Tests may import `authEmailCopy` from `@/lib/email/copy` if that is where it lives; pick one public path: **`authEmailCopy` from `lib/email/copy.ts`**, **`buildAuthVerifyUrl` from `lib/email/auth-mail.ts`**. Update the test imports to match:

```ts
import { authEmailCopy } from "@/lib/email/copy";
import { buildAuthVerifyUrl } from "@/lib/email/auth-mail";
import { formatPlatformFrom } from "@/lib/email/from";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/email/auth-mail.test.ts`

Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

`buildAuthVerifyUrl`: strip trailing slash on `supabaseUrl`, then:

```ts
const params = new URLSearchParams({
  token: opts.tokenHash,
  type: opts.emailActionType,
  redirect_to: opts.redirectTo,
});
return `${base}/auth/v1/verify?${params.toString()}`;
```

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run tests/email/auth-mail.test.ts tests/email/layout.test.ts`

Expected: PASS

- [ ] **Step 5: Commit** (only if asked)

```bash
git add lib/email/copy.ts lib/email/auth-mail.ts lib/email/from.ts tests/email/auth-mail.test.ts
git commit -m "feat(email): add Auth copy, verify URL, and From formatting"
```

---

### Task 3: `preferred_locale` column

**Files:**
- Create: `supabase/migrations/20260819120000_user_preferred_locale.sql`

**Interfaces:**
- Consumes: `public.users` from foundation
- Produces: column `preferred_locale text not null default 'en'` with check `(preferred_locale in ('en', 'ms'))`

- [ ] **Step 1: Add the migration**

```sql
-- NiagaX — email / UI language preference (en | ms)
alter table public.users
  add column if not exists preferred_locale text not null default 'en';

alter table public.users
  drop constraint if exists users_preferred_locale_check;

alter table public.users
  add constraint users_preferred_locale_check
  check (preferred_locale in ('en', 'ms'));

comment on column public.users.preferred_locale is
  'Email and Appearance language: en (default) or ms.';
```

Do not change RLS. Profile API whitelist is the column guard.

- [ ] **Step 2: Apply locally if Docker is running**

Run: `npx supabase db push --linked --yes` only against the linked remote when the user wants production schema, or `npx supabase migration up` for local. If local Supabase is not running, leave the file for the next `db push` and continue.

- [ ] **Step 3: Commit** (only if asked)

```bash
git add supabase/migrations/20260819120000_user_preferred_locale.sql
git commit -m "feat(email): add users.preferred_locale en|ms"
```

---

### Task 4: Profile GET/PATCH locale

**Files:**
- Modify: `lib/settings/schemas.ts` (`profileUpdateSchema`)
- Modify: `app/api/settings/profile/route.ts`
- Modify: `tests/settings/profile-api.test.ts`
- Test: `tests/settings/profile-locale-schema.test.ts`

**Interfaces:**
- Consumes: `preferred_locale` column (Task 3)
- Produces: GET `{ ok: true, profile: { ..., preferred_locale } }`; PATCH whitelist `preferred_locale: "en" | "ms"`

- [ ] **Step 1: Write failing schema + route tests**

`tests/settings/profile-locale-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { profileUpdateSchema } from "@/lib/settings/schemas";

describe("profileUpdateSchema locale", () => {
  it("accepts en and ms", () => {
    expect(profileUpdateSchema.parse({ preferred_locale: "ms" }).preferred_locale).toBe("ms");
    expect(profileUpdateSchema.parse({ preferred_locale: "en" }).preferred_locale).toBe("en");
  });

  it("rejects other locales", () => {
    expect(() => profileUpdateSchema.parse({ preferred_locale: "fr" })).toThrow();
  });

  it("rejects unknown keys", () => {
    expect(() =>
      profileUpdateSchema.parse({ preferred_locale: "en", role: "owner" }),
    ).toThrow();
  });
});
```

Extend `CURRENT_PROFILE` in `tests/settings/profile-api.test.ts` with `preferred_locale: "en"`. Add a test that PATCH `{ preferred_locale: "ms" }` puts `{ preferred_locale: "ms" }` in `updatePayloads` and that GET returns 200 with `preferred_locale`. Mirror existing harness (`vi.mock` auth + supabase). If adding GET is easier as a new `it("GET returns preferred_locale")` in the same harness, do that: GET must `.eq("id", user.id).eq("business_id", user.businessId)` (BOLA).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/settings/profile-locale-schema.test.ts tests/settings/profile-api.test.ts`

Expected: schema test FAIL (`preferred_locale` unknown); route tests FAIL until GET exists.

- [ ] **Step 3: Implement**

In `lib/settings/schemas.ts` add to the strict object:

```ts
preferred_locale: z.enum(["en", "ms"]).optional(),
```

In `app/api/settings/profile/route.ts`:

- Extend `ProfileRow` with `preferred_locale: "en" | "ms"`
- `SAFE_PROFILE_SELECT = "id, display_name, phone_e164, email, role, preferred_locale"`
- `safeProfile` includes `preferred_locale: row.preferred_locale === "ms" ? "ms" : "en"`
- `ProfileDiff` may include `preferred_locale`
- PATCH: if `hasOwn(parsed, "preferred_locale")` and value differs, set `updates.preferred_locale`
- Add `GET` using `getCurrentUser()`, same select + BOLA `.eq` pair, 401/404/500 same as PATCH

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/settings/profile-locale-schema.test.ts tests/settings/profile-api.test.ts`

Expected: PASS

- [ ] **Step 5: Commit** (only if asked)

```bash
git add lib/settings/schemas.ts app/api/settings/profile/route.ts tests/settings/profile-api.test.ts tests/settings/profile-locale-schema.test.ts
git commit -m "feat(settings): persist preferred_locale on profile"
```

---

### Task 5: Appearance language control

**Files:**
- Create: `components/settings/AppearanceLanguageCard.tsx`
- Modify: `app/(app)/settings/appearance/page.tsx`

**Interfaces:**
- Consumes: `GET`/`PATCH` `/api/settings/profile` (Task 4)
- Produces: Language card (English / Bahasa Melayu) on Appearance

- [ ] **Step 1: Add the client card**

`"use client"` card matching Theme radios. On mount `GET /api/settings/profile` with `credentials: "same-origin"`. Selected value from `json.profile.preferred_locale`. On change `PATCH` `{ preferred_locale }`. Ignore non-`en`/`ms`. Show a short error string on non-OK (use `apiErrorMessage` if already used in settings).

Update hero subcopy: language is saved on the account; theme remains this browser only.

- [ ] **Step 2: Render the card on the appearance page** between Theme and Preview.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

Expected: PASS (or only pre-existing errors unrelated to these files)

- [ ] **Step 4: Commit** (only if asked)

```bash
git add components/settings/AppearanceLanguageCard.tsx app/(app)/settings/appearance/page.tsx
git commit -m "feat(settings): add Appearance language en|ms"
```

---

### Task 6: Hook secret + send-email route

**Files:**
- Create: `lib/email/hook-secret.ts`
- Create: `lib/email/resolve-locale.ts`
- Create: `app/api/webhooks/auth-send-email/route.ts`
- Test: `tests/email/hook-secret.test.ts`
- Test: `tests/email/auth-send-email-route.test.ts`
- Modify: `lib/env/production-checks.ts` — add optional `AUTH_SEND_EMAIL_HOOK_SECRET`

**Interfaces:**
- Consumes: Tasks 1–4, `sendEmail` from `lib/marketing/email-resend.ts`, `createServiceRoleClient`, `enforceAuthRateLimit`, `logger`, `formatPlatformFrom`, `authEmailCopy`, `buildAuthVerifyUrl`, `renderNiagaXEmail`
- Produces:
  - `export function parseHookSecret(raw: string): Buffer` — strip `v1,whsec_` then base64-decode
  - `export function verifyAuthHookSignature(opts: { rawBody: string; headers: Headers; secretRaw: string; nowMs?: number }): boolean`
  - `POST /api/webhooks/auth-send-email` → 401/429/400/500/200 `{ ok: true }`

Standard Webhooks (no extra npm package):

- Signed content: `${webhook-id}.${webhook-timestamp}.${rawBody}`
- Secret: `AUTH_SEND_EMAIL_HOOK_SECRET` looks like `v1,whsec_<base64>`
- Header `webhook-signature` is space-separated `v1,<base64hmac>`
- HMAC SHA256, compare with `timingSafeEqual`
- Reject if `|now - timestamp| > 300` seconds

`resolvePreferredLocale(admin, userId: string): Promise<EmailLocale>` — select `preferred_locale` from `users` where `id = userId`; if no row or value not `ms`, return `en`.

Rate limit: `enforceAuthRateLimit(request, "auth.send-email-hook", 30, 60_000)`.

Handler outline:

1. Rate limit.
2. If secret env missing → 503 `{ error: "not_configured" }` (do not send).
3. `rawBody = await request.text()`; if `!verifyAuthHookSignature` → 401 `{ error: "unauthorized" }`.
4. Parse JSON; require `user.email` (string) and `email_data.email_action_type` (string) and `email_data.token_hash` (string). Else 400 `{ error: "invalid_payload" }`.
5. Locale via `resolvePreferredLocale`.
6. `redirectTo` from payload string or `""`. `supabaseUrl` from `process.env.NEXT_PUBLIC_SUPABASE_URL`. If missing supabase URL → 500 `{ error: "send_failed" }`.
7. `action = email_data.email_action_type`. `businessName` / `inviterName` only if they are strings on `user.user_metadata` (`business_name`, `inviter_name` or similar); otherwise omit.
8. For `reauthentication`, body appends the 6-digit `email_data.token` (escaped in HTML via renderer). Omit `ctaHref` (OTP is the factor).
9. Other actions: `ctaHref = buildAuthVerifyUrl(...)`.
10. `sendEmail({ to: user.email, subject, body: textPart, html, fromEmail: formatPlatformFrom(MARKETING_FROM_EMAIL), apiKey })`.
11. If `!result.ok` → `logger.error("auth.email_hook.send_failed", { userId: user.id, reason: result.reason })` — **no email address in logs**. Return 500 `{ error: "send_failed" }`.
12. 200 `{ ok: true }`.

Text part: `heading\n\nbodyText\n\nctaHref or token`.

- [ ] **Step 1: Write failing tests**

`tests/email/hook-secret.test.ts`: create HMAC with a known `whsec_` secret, assert `verifyAuthHookSignature` true; wrong sig false; missing headers false; timestamp 400 seconds old false.

`tests/email/auth-send-email-route.test.ts`: mock `sendEmail`, `createServiceRoleClient`, env secret. POST without signature → 401 and `sendEmail` not called. POST with valid signature → 200 and `sendEmail` called with `html` containing `#0E7490` and `to` matching payload email.

Helper to sign in tests (same algorithm as production).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/email/hook-secret.test.ts tests/email/auth-send-email-route.test.ts`

Expected: FAIL — modules/route missing

- [ ] **Step 3: Implement hook-secret, resolve-locale, route**

`logger` is `server-only` — the route may import it; unit tests should mock `@/lib/logger` if importing the route pulls `server-only`. Follow `tests/settings/profile-api.test.ts` dynamic import after `vi.mock`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/email/`

Expected: PASS

- [ ] **Step 5: Add production check**

```ts
{
  key: "AUTH_SEND_EMAIL_HOOK_SECRET",
  ok: Boolean(process.env.AUTH_SEND_EMAIL_HOOK_SECRET?.trim()),
  required: false,
  hint: "Supabase Auth Send Email hook signing secret.",
},
```

- [ ] **Step 6: Commit** (only if asked)

```bash
git add lib/email/hook-secret.ts lib/email/resolve-locale.ts app/api/webhooks/auth-send-email/route.ts tests/email/hook-secret.test.ts tests/email/auth-send-email-route.test.ts lib/env/production-checks.ts
git commit -m "feat(email): add Auth Send Email hook for Resend"
```

---

### Task 7: Broadcasts use shared chrome

**Files:**
- Modify: `lib/marketing/email-broadcast-template.ts`
- Modify: `tests/marketing/email-broadcast-template.test.ts`

**Interfaces:**
- Consumes: `renderNiagaXEmail`, `escapeHtml` from Task 1
- Produces: `buildMarketingEmailHtml` still exported with the same options interface

- [ ] **Step 1: Update the existing test** so HTML contains `#0E7490` and `#EEF2F6` and does **not** contain `#6d28d9` or `linear-gradient`. Keep the XSS assertions (`Cafe &amp; Co`, escaped body).

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/marketing/email-broadcast-template.test.ts`

Expected: FAIL on purple/gradient assertions until implementation

- [ ] **Step 3: Reimplement `buildMarketingEmailHtml`** as a wrapper:

```ts
return renderNiagaXEmail({
  locale: "en",
  brandName: opts.businessName?.trim() || "Your business",
  subject: opts.subject,
  heading: opts.subject,
  bodyText: opts.bodyText,
  footerText:
    "You received this because you are a customer of this business. Bantu Niaga Sdn. Bhd.",
  previewText: opts.previewText,
});
```

Keep `plainTextToHtmlBody` only if still used; otherwise delete and use layout body rendering. Update tests if `plainTextToHtmlBody` is removed.

Broadcasts stay English in v1 (tenant customer mail, not `preferred_locale`). Spec: chrome only.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/marketing/email-broadcast-template.test.ts tests/email/layout.test.ts`

Expected: PASS

- [ ] **Step 5: Commit** (only if asked)

```bash
git add lib/marketing/email-broadcast-template.ts tests/marketing/email-broadcast-template.test.ts
git commit -m "feat(email): restyle marketing broadcasts with NiagaX chrome"
```

---

### Task 8: Invoice + digest HTML

**Files:**
- Modify: `app/api/finance/invoices/[id]/send/route.ts`
- Modify: `lib/privacy/platform-email.ts`
- Modify: `app/api/cron/boardroom-weekly-digest/route.ts`

**Interfaces:**
- Consumes: `renderNiagaXEmail`, `formatPlatformFrom`, `sendEmail` (already has `html?`)
- Produces: invoice and digest include `html`

- [ ] **Step 1: Invoice send**

After `buildInvoiceShareMessage`, build:

```ts
const html = renderNiagaXEmail({
  locale: "en",
  brandName: business.name,
  subject: `Invoice ${invoice.number} from ${business.name}`,
  heading: `Invoice ${invoice.number}`,
  bodyText: message,
  ctaLabel: "View invoice",
  ctaHref: shareUrl || undefined,
  footerText: "You received this invoice from a NiagaX customer. Bantu Niaga Sdn. Bhd.",
});
```

Pass `html` into existing `sendEmail`. Keep PDF attachment. Keep tenant From as `{fromName} <${fromEmail}>` (not `formatPlatformFrom`).

- [ ] **Step 2: platform-email + digest**

Extend `sendPlatformEmail` input with optional `html?: string` and pass through to `sendEmail`.

In the digest cron, after `buildBoardroomWeeklyDigest`:

```ts
const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
const html = renderNiagaXEmail({
  locale: "en",
  brandName: "NiagaX",
  subject: digest.subject,
  heading: digest.subject,
  bodyText: digest.body,
  ctaLabel: "Open Boardroom",
  ctaHref: appUrl ? `${appUrl}/boardroom` : undefined,
  footerText: "Weekly Boardroom digest from NiagaX. Bantu Niaga Sdn. Bhd.",
});
```

Pass `html` into `sendPlatformEmail`. From remains `fromEmail` env (then wrap with `formatPlatformFrom` in the cron or inside `sendPlatformEmail` for platform category only). Apply `formatPlatformFrom(fromEmail)` in the digest cron when calling send.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

Expected: PASS for these files

- [ ] **Step 4: Commit** (only if asked)

```bash
git add app/api/finance/invoices/[id]/send/route.ts lib/privacy/platform-email.ts app/api/cron/boardroom-weekly-digest/route.ts
git commit -m "feat(email): wrap invoice and digest mail in NiagaX HTML"
```

---

### Task 9: Docs + operator checklist

**Files:**
- Modify: `docs/DEPLOY-SMTP.md`
- Modify: `docs/superpowers/specs/2026-08-19-niagax-transactional-email-design.md` — set status to `Approved, plan ready`

- [ ] **Step 1: Document hook setup** in `docs/DEPLOY-SMTP.md` after SMTP section:

1. Set Vercel `AUTH_SEND_EMAIL_HOOK_SECRET` to the secret Supabase shows when creating the hook (`v1,whsec_...`).
2. Authentication → Hooks → Send Email → HTTPS `https://app.niagax.my/api/webhooks/auth-send-email`.
3. After the hook is on, GoTrue will not send its built-in HTML. Leave dashboard templates with a one-line note: `Handled by NiagaX Send Email hook.`
4. Confirm in Resend: From `noreply@app.niagax.my`, one mail per reset, not `noreply@mail.app.supabase.io`.
5. Appearance → Bahasa Melayu, then reset, to verify MS copy.

- [ ] **Step 2: Commit** (only if asked)

```bash
git add docs/DEPLOY-SMTP.md docs/superpowers/specs/2026-08-19-niagax-transactional-email-design.md
git commit -m "docs: Auth Send Email hook and NiagaX mail operator steps"
```

---

### Task 10: Verify suite

- [ ] **Step 1: Run**

```bash
npx vitest run tests/email tests/settings/profile-locale-schema.test.ts tests/settings/profile-api.test.ts tests/marketing/email-broadcast-template.test.ts
npx tsc --noEmit
```

Expected: all PASS

- [ ] **Step 2: Manual after deploy (operator, not CI)**

Follow spec §13: env, enable hook, one forgot-password, one signup/invite, MS appearance reset.

---

## Spec coverage (self-review)

| Spec section | Task |
|--------------|------|
| Shared layout / colors / escape | 1 |
| Auth copy EN/MS + verify URL + From | 2 |
| `preferred_locale` column | 3 |
| Appearance + profile whitelist / BOLA | 4, 5 |
| Send Email hook + secret + 401/500 | 6 |
| Broadcasts drop purple | 7 |
| Invoice + digest HTML | 8 |
| Operator docs | 9 |
| Tests listed in spec §12 | 1, 2, 4, 6, 7, 10 |

Invite business name uses `user_metadata` strings only (payload is untrusted except after signature verify). Reauthentication uses OTP, no verify URL.
