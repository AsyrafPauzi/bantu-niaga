# NiagaX transactional email — Design Spec

**Date:** 2026-08-19  
**Status:** Approved, plan ready (`docs/superpowers/plans/2026-08-19-niagax-transactional-email.md`)

---

## 1. Problem

Auth mail (confirm signup, reset password, invite, magic link, email change) still uses default GoTrue HTML. App mail is inconsistent: marketing broadcasts use an old purple wrapper; invoices and the Boardroom digest are mostly plain text. NiagaX already has a teal/paper brand and a verified Resend sender (`noreply@app.niagax.my`), but nothing shares one look or the user’s language.

---

## 2. Goals

| Goal | Success criteria |
|------|------------------|
| One look | Every outbound HTML mail uses the same NiagaX chrome (paper, teal bar, wordmark, one CTA) |
| One sender path | Resend sends Auth and app mail; GoTrue does not send a second Auth mail |
| Language | User picks English or Bahasa Melayu in Settings → Appearance; mail uses that; no account → English |
| Warm copy | Short owner-friendly EN/MS strings, not legal boilerplate |
| Safe | Hook secret required; HTML escaped; locale whitelist `en` \| `ms`; no secrets in responses |

---

## 3. Non-goals (this pass)

- Translating the whole in-app UI (only Appearance language + email copy)
- Kelantan / Chinese / Tamil email variants (AI detector stays unrelated)
- Unsubscribe for Auth / invoice / digest (only marketing broadcasts keep unsubscribe if they already have it)
- React Email / MJML compilers (inline-table HTML is enough)
- Changing the From **domain** (keep `MARKETING_FROM_EMAIL` / `noreply@app.niagax.my`)
- Dark-mode email variants

---

## 4. Architecture

```
Supabase Auth event
  → Send Email Hook (HTTPS)
    → POST /api/webhooks/auth-send-email
      → verify hook secret
      → resolve locale (public.users.preferred_locale or en)
      → renderNiagaXEmail(...)
      → Resend

Invoice / digest / broadcast
  → same renderNiagaXEmail(...)
  → Resend (existing sendEmail / sendEmailBatch)
```

- Hook lives under `/api/webhooks/` so existing middleware already skips session auth (`matcher` excludes `webhooks`).
- If the hook is enabled in the Supabase dashboard, GoTrue **does not** send its own template. Dashboard Auth templates become unused fallbacks; we still paste a plain one-line note there (“handled by NiagaX hook”) so a misconfigured hook is obvious.
- Invitees and brand-new signups have no `public.users` row yet (or no locale) → **English**. Not the inviter’s language.

---

## 5. Data model

Add `preferred_locale` on `public.users`:

| Column | Type | Rules |
|--------|------|--------|
| `preferred_locale` | `text not null default 'en'` | `check (preferred_locale in ('en', 'ms'))` |

- Existing rows default to `en`.
- RLS: keep `users_self_profile_update` (own row only). API **whitelist** is the real column guard (Postgres RLS cannot limit columns).
- Hook reads with the **service role** (Auth has no user JWT). Never trust locale from the hook payload body except as a last-resort hint from `user.user_metadata` if we later set it; v1 source of truth is `public.users.preferred_locale`.

---

## 6. Appearance language

Settings → Appearance already has Theme (browser-only). Add a **Language** card on the same page:

- Options: English (`en`), Bahasa Melayu (`ms`)
- Persist via existing profile mutation path: extend `PATCH /api/settings/profile` to accept `preferred_locale` only (`en` \| `ms`). Reject any other key/value (mass assignment).
- Authorization: session user updates **their own** `public.users` id only (existing BOLA pattern on that route).
- GET profile (or the appearance page load) must return `preferred_locale` so the control is not client-only.

Default for new sign-ups: `'en'` (DB default). Do not infer from `Accept-Language` in v1.

---

## 7. Shared renderer

New module `lib/email/` (server-safe HTML strings, no React runtime required):

| File | Responsibility |
|------|----------------|
| `layout.ts` | Table-based HTML shell + `escapeHtml` |
| `copy.ts` | EN/MS strings for Auth actions + shared footer |
| `auth-mail.ts` | Map hook `email_action_type` → subject, heading, body, CTA label, verify URL |
| `types.ts` | `EmailLocale`, layout input types |

**Visual (inline CSS only, 560px card):**

- Page background `#EEF2F6`
- Header bar `#0E7490`, white **NiagaX** text (platform) or escaped **business name** (invoice / tenant broadcast)
- Body: heading + 1–2 short paragraphs, `#0B1220`
- One button `#0E7490`, white label, `href` is the only CTA
- Footer 12px `#6b7280`: why they got the mail; **Bantu Niaga Sdn. Bhd.**; Auth/reset note that the link expires (~1 hour, as GoTrue default)

No CSS `linear-gradient` (current broadcast purple gradient is removed).

**Auth CTA URL** (do not invent a custom token scheme):

Use the project URL + GoTrue verify query as documented for Send Email hooks:

`{NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify?token={token_hash}&type={email_action_type}&redirect_to={redirect_to}`

`redirect_to` and hashes come only from the verified hook payload. Escape for HTML attributes.

**From header:** `NiagaX <{MARKETING_FROM_EMAIL}>` when `MARKETING_FROM_EMAIL` is a bare address; if it already includes a display name, use it as-is. Tenant invoices may keep `{business email_from_name} <platform from>` as today.

---

## 8. Auth copy (warm SME)

English (default). Bahasa Melayu is the same meaning, not a literal legal translation.

| `email_action_type` | Subject | Heading | Body | Button |
|---------------------|---------|---------|------|--------|
| `signup` | Confirm your NiagaX email | Confirm your email | Confirm your email to finish setting up NiagaX. | Confirm email |
| `recovery` | Reset your NiagaX password | Set a new password | We got a request to reset your password. If this wasn’t you, ignore this email. | Set new password |
| `invite` | You’re invited to {business} on NiagaX | Join the team | {inviter or “A teammate”} invited you to {business} on NiagaX. | Join team |
| `magiclink` | Your NiagaX sign-in link | Sign in to NiagaX | Use this link to sign in. It works once. | Sign in |
| `email_change` | Confirm your new NiagaX email | Confirm your new email | Confirm this address to finish changing your email. | Confirm email |
| `reauthentication` | Confirm it’s you | Confirm it’s you | Confirm this action on your NiagaX account. | Confirm |

Unknown `email_action_type` → English generic “Continue in NiagaX” + still send (do not drop the mail).

Always send a **text** part (plain sentences + raw URL) alongside HTML.

---

## 9. App mail that must use the layout

| Mail | Header brand | CTA |
|------|----------------|-----|
| Auth (hook) | NiagaX | Verify / reset / join URL |
| Invoice send | Business name | Share URL (PDF still attached) |
| Boardroom weekly digest | NiagaX | Open Boardroom (`{APP_URL}/boardroom`) |
| Marketing broadcasts | Business name | Existing body; chrome only (no Auth CTA unless the body already has links) |

`sendPlatformEmail` / `sendEmail` gain an optional `html` built by the renderer. Plain `body` remains required for clients that strip HTML.

---

## 10. Send Email hook

**Route:** `POST /api/webhooks/auth-send-email`  
**Runtime:** Node (`force-dynamic`).  
**Auth:** Verify Supabase Auth hook signature / secret from env `AUTH_SEND_EMAIL_HOOK_SECRET` (never `NEXT_PUBLIC_*`). Reject 401 on mismatch. Follow current Supabase **Send Email Hook** signing (Standard Webhooks) so we do not accept forged POSTs.

**Rate limit:** Same family as other auth routes (IP-based). Fail closed on abuse.

**Handler steps:**

1. Verify secret.
2. Parse payload; require `user.email` and `email_data.email_action_type`.
3. Load `preferred_locale` by `user.id` if a `public.users` row exists; else `en`.
4. Build verify URL from payload fields only.
5. `sendEmail` via Resend. On Resend/config failure: log server-side (no PII beyond user id), return **500** so Auth can retry. Do not return stack traces or Resend bodies to the hook caller.
6. Success: **200** `{ ok: true }`.

**Dashboard (operator, not code):** Authentication → Hooks → Send Email → `https://app.niagax.my/api/webhooks/auth-send-email`. Also set the same URL on preview if used. Document in `docs/DEPLOY-SMTP.md`.

**Vercel env:** `AUTH_SEND_EMAIL_HOOK_SECRET` (Production + Preview). `MARKETING_FROM_EMAIL` already required for send.

---

## 11. Error handling

| Case | Behaviour |
|------|-----------|
| Bad hook secret | 401, no send |
| Missing Resend / From | 500 on hook; existing 412 on invoice/broadcast |
| Resend 4xx/5xx | 500 on hook; existing error JSON on app routes |
| Invalid locale on PATCH | 400 |
| XSS in business name / subject | Escaped in HTML |
| User enumeration | Forgot-password route still always 200; hook only runs after Auth already decided to mail |

---

## 12. Testing

- `escapeHtml` / layout: `<script>` and `&` in names never appear raw.
- Copy: `signup` + `recovery` resolve EN and MS (spot-check one heading each).
- Hook: missing/wrong secret → 401; valid payload with stubbed Resend → 200.
- Profile PATCH: only own row; `preferred_locale: 'fr'` → 400; `'ms'` persists.
- Broadcast HTML: contains `#0E7490`, does not contain the old `#6d28d9` purple.

No live Resend in CI (stub `fetch` / `sendEmail`).

---

## 13. Operator checklist (after merge)

1. Deploy with `AUTH_SEND_EMAIL_HOOK_SECRET` and `MARKETING_FROM_EMAIL`.
2. Enable Send Email hook pointing at production URL.
3. Trigger forgot-password once (after rate-limit window) and confirm **one** NiagaX HTML mail in Resend, none from `mail.app.supabase.io`.
4. Confirm signup / invite the same way.
5. Set Appearance → Bahasa Melayu, request reset, confirm MS copy.

---

## 14. Out of scope leftovers

Supabase dashboard SMTP stays Resend (already required for delivery). This spec does not replace SMTP with the Resend HTTP API for GoTrue’s built-in mailer; the hook **is** the HTTP path.
