# Sign-up language preference — Design Spec

**Date:** 2026-08-19  
**Status:** Written — awaiting user review of this file

---

## 1. Problem

Owners can already pick English or Bahasa Melayu in Settings → Appearance (`public.users.preferred_locale`). Auth mail uses that column. Sign-up never asks, so every new account (and the confirm-email) starts as English.

---

## 2. Goals

| Goal | Success criteria |
|------|------------------|
| Choose at sign-up | Email `/sign-up` and Google `/sign-up/complete` require English (`en`) or Bahasa Melayu (`ms`) before submit |
| Persist on the account | Provision writes `public.users.preferred_locale`; Settings → Appearance shows the same value |
| Auth mail in that language | Confirm email, reset, magic link, email change, reauthentication use the saved locale |
| Owner product mail | Boardroom digest `html lang`, CTA, and footer follow the owner’s locale |
| Change later | Existing `PATCH /api/settings/profile` still updates own row only |

---

## 3. Non-goals (this pass)

- Translating in-app UI (nav, modules, sign-up field labels stay English)
- Language on `/sign-up/guide`
- Inferring locale from `Accept-Language` or the browser
- Kelantan / Chinese / Tamil
- Invoice emails to customers (recipient is not the NiagaX user; stay English)
- Marketing broadcasts to a business list (stay as today)
- Invitee language at invite time (no profile yet → English; they set it in Settings after join)
- Translating Boardroom digest **body** (AI English stays; only `html lang`, CTA, and footer follow locale)
- Changing the DB default (`en` remains for rows that omit the column)
- next-intl or other app i18n framework

---

## 4. User flow

Neither language card is pre-selected. They must pick one.

```
Email /sign-up
  → pick plan + language + business fields
  → POST /api/auth/sign-up { preferred_locale: "en" | "ms", ... }
  → Auth user (metadata hint) + public.users.preferred_locale
  → confirm-email in that language (when verification is on)

Google OAuth
  → /sign-up/complete
  → pick plan + language + business fields
  → POST /api/auth/complete-google-signup { preferred_locale: "en" | "ms", ... }
  → same profile write; no confirm-email (Google already verified)
```

After success they can still change language in Settings → Appearance.

---

## 5. Pages

Reuse the Settings two-card look (English / Bahasa Melayu). Signup cards are **local state only** (no GET/PATCH). Settings `AppearanceLanguageCard` stays the load-and-save version.

| Page | Behaviour |
|------|-----------|
| `/sign-up` | Cards after plan (Start free / 14-day Solo trial), before Business name. Caption: “Used for emails. You can change this later in Settings.” Field labels stay English. |
| `/sign-up/complete` | Same cards, same place. Email remains read-only. Ignore any locale on the OAuth `next` query string. |
| Settings → Appearance | Unchanged. After sign-up it shows the stored locale. |

Client: if they submit with no pick, stay on the form with “Choose English or Bahasa Melayu.” Do not disable the submit button (screen readers and click-to-see-error).

---

## 6. Data and APIs

Column already exists:

| Column | Type | Rules |
|--------|------|--------|
| `public.users.preferred_locale` | `text not null default 'en'` | `check (preferred_locale in ('en', 'ms'))` |

Source of truth is this column. Auth `user_metadata.preferred_locale` is a **hint** for the confirm-email race (hook may fire before the profile row exists). Never use `user_metadata` for authorization.

### `POST /api/auth/sign-up`

Add required `preferred_locale: "en" | "ms"` to `signUpSchema` (`.strict()` unchanged).

1. `createUser` `user_metadata` includes `preferred_locale` next to existing `business_name` / `signup_source`.
2. `provisionOwnerBusiness` inserts `preferred_locale` on `public.users`.
3. Verification email (when required) follows the hook locale rules below.

### `POST /api/auth/complete-google-signup`

Same required field on `completeGoogleSignupSchema`. Session `auth.uid` only. Provision writes the column. After success, admin-update Auth `user_metadata.preferred_locale` so later Auth mail matches. Idempotent complete (already has profile) does not change locale.

### `PATCH /api/settings/profile`

Unchanged: own row, whitelist `en` \| `ms`.

---

## 7. Email locale resolution

Extend `resolvePreferredLocale` (or the Auth hook around it):

1. If `public.users.preferred_locale` is `ms` or `en`, use it.
2. Else if Auth `user_metadata.preferred_locale` is exactly `ms` or `en`, use that hint.
3. Else `en`.

Any other string (`fr`, empty, tampered metadata) → `en`.

| Mail | Locale |
|------|--------|
| Auth to that user (signup confirm, recovery, magic link, email change, reauthentication) | Resolution above |
| Boardroom weekly digest to the **owner** | Owner locale for `html lang`, CTA, footer. Digest body stays as generated today. |
| Invoice to **customer** | English (out of scope) |
| Marketing broadcast | Unchanged (out of scope) |
| Team invite (no invitee profile) | English |

Reuse existing EN/MS strings in `lib/email/copy.ts`. No new templates.

---

## 8. Security

- BOLA: provision still uses session / created Auth id. No client-supplied user id.
- Mass assignment: locale only via Zod on sign-up bodies; profile PATCH whitelist unchanged.
- Preference ≠ permission: do not read `user_metadata` in RLS or middleware.
- XSS: render locale labels as text; email HTML remains escaped.
- Generic API errors to the client; log details server-side.

---

## 9. Errors (user-facing)

| Case | Behaviour |
|------|-----------|
| No language picked (client) | Stay on form: “Choose English or Bahasa Melayu.” |
| Missing / invalid `preferred_locale` (API) | `400` `validation_failed` |
| `"fr"` or extra body keys | `400` (strict schema) |
| Provision / server failure | Existing generic message; no stack traces |

---

## 10. Testing

- `signUpSchema` / `completeGoogleSignupSchema`: accept `en` and `ms`; reject missing, `"fr"`, extra keys.
- Provision insert includes `preferred_locale`.
- Auth hook: profile `ms` → Malay copy; no profile + metadata `ms` → Malay copy; neither → English; metadata `fr` → English.
- Boardroom digest passes the owner’s locale into the renderer (MS CTA/footer).
- Google complete writes locale the same way as email sign-up.
- Profile PATCH still own-row only (existing tests).

No live Resend in CI.

---

## 11. Key files

- `app/sign-up/page.tsx` — language cards
- `app/sign-up/complete/complete-form.tsx` — language cards
- `lib/auth/schemas.ts` — required `preferred_locale`
- `lib/auth/provision-owner-business.ts` — insert column
- `app/api/auth/sign-up/route.ts` — metadata + provision input
- `app/api/auth/complete-google-signup/route.ts` — same + metadata update
- `lib/email/resolve-locale.ts` — metadata hint fallback
- `app/api/webhooks/auth-send-email/route.ts` — pass hint into resolver
- `app/api/cron/boardroom-weekly-digest/route.ts` — owner locale
- `tests/auth/*`, `tests/email/*` — schema, provision, hook, digest

---

*Decisions: first pass is signup + emails only (A); required explicit pick, no silent default (A); persist on `public.users` at provision with metadata hint (approach 1); customer invoices stay English; invitees stay English until Settings.*
