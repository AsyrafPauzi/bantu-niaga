# Google sign-up complete — Design Spec

**Date:** 2026-08-19  
**Status:** Approved for planning (user: okay next)

---

## 1. Problem

Continue with Google is SaaS sign-in only. After Google succeeds, users never pick a plan or fill business name, state, and terms. New Google emails are bounced (`no_account`). Existing emails skip sign-up entirely and land in the app.

Email sign-up already collects plan, business name, state, terms, then sends owners to `/onboarding/recommendation`. Google must reach the same outcome without a password.

---

## 2. Goals

| Goal | Success criteria |
|------|------------------|
| Google on both auth pages | SaaS `/sign-in` and `/sign-up` show Continue with Google |
| New Google users finish sign-up | After Google they fill plan, business name, state, terms; email locked; no password |
| Same provision as email | Business + owner profile + welcome invoice (+ trial credits on Solo path) match `/api/auth/sign-up` |
| Same next page | Success goes to `/onboarding/recommendation` |
| Existing accounts sign in | Profile for this Auth user id → `/home` (or unfinished owner onboarding). No new-business form |
| Incomplete users blocked | Session without `public.users` cannot use `/home` or app APIs |

---

## 3. Non-goals (this pass)

- Standalone Google (button stays hidden; complete API returns 403)
- Changing the email/password sign-up form
- Auto-creating a business from Google name without the form
- Merging two Auth users when the same email exists on a different Auth id (show an error instead)
- Cleanup job for abandoned Google Auth users who never complete
- Google on `/sign-up/guide`
- Native/mobile Google SDK (web OAuth only)

---

## 4. User flow

SaaS only.

```
Continue with Google (/sign-in or /sign-up)
  → Google OAuth
  → GET /auth/callback
       ├─ public.users.id = auth uid           → /home (or `next`, sanitized)
       ├─ no profile, email on another row     → sign out → /sign-in?auth_error=email_taken
       └─ no profile, email unused             → keep session → /sign-up/complete
            → POST /api/auth/complete-google-signup
            → /onboarding/recommendation
```

Owners with a profile and `onboarding_completed_at` null still hit the existing `/home` → `/onboarding/recommendation` redirect. That path does not change.

Closing the tab before complete: next Google click returns them to `/sign-up/complete`. That Gmail cannot use email+password sign-up until they finish (Auth email is already registered).

---

## 5. Pages

| Page | Behaviour |
|------|-----------|
| `/sign-in` | Existing Google button (SaaS). Unchanged layout besides error codes below. |
| `/sign-up` | Add Continue with Google above the email form (same split as sign-in). Email+password path unchanged. |
| `/sign-up/complete` | Google session, no `public.users` row. Fields: plan (free vs 14-day Solo), business name, operating state, terms. Email read-only from session. No password. Sign-out link. |
| `/sign-up/complete` guards | No session → `/sign-in`. Has profile → `/home`. Standalone → `/sign-in`. |

Reuse existing sign-up field copy, plan cards, terms checkbox, and `readQuizFromSession()` so a prior `/sign-up/guide` quiz still applies.

---

## 6. APIs and callback

### `GET /auth/callback`

After `exchangeCodeForSession` and `getUser()`:

1. Load `public.users` by `id = auth uid`.
2. If row exists → register session cookie (existing) → redirect `next`.
3. Else load `public.users` by email (trim + lower-case, service role). If a **different** id owns that email → `signOut` → `/sign-in?auth_error=email_taken`.
4. Else keep session → `/sign-up/complete`. Do **not** `signOut`.

Email comparison must use the session email, not a client query param.

### `POST /api/auth/complete-google-signup`

- Auth: session required. Reject if standalone.
- Rate limit: same bucket style as `auth.sign-up` (5 / hour).
- Identity: `auth.uid` + `user.email` from the server session only. Ignore any `email` in the body.
- If `public.users` already exists for this uid → `200` with `{ ok: true, already_complete: true }` (idempotent; client goes to `/home` or onboarding).
- If email belongs to another profile → `409` `email_taken`.
- Body (Zod `.strict()`):

```ts
{
  business_name: string,       // trim, 2–120
  state_code?: MY_STATE,       // same enum as signUpSchema
  accept_terms: true,
  signup_path: "free" | "starter_trial",  // default "free"
  onboarding_quiz?: OnboardingQuizInput
}
```

- Provision: extract the existing “create business + owner profile + membership + invoice + trial credits + audit + PDPA consents” pipeline from `/api/auth/sign-up` into a shared helper. Complete path **does not** `createUser` and **does not** delete the Auth user on failure.
- On provision failure after a business insert: delete profile/membership/business (same reverse order as today). Keep Auth user.
- `display_name`: business name (same as email sign-up).
- `signup_source` metadata: `google` (optional `user_metadata` write via admin; not used for authorization).
- Success: `{ ok: true }` — client navigates to `/onboarding/recommendation`.

Email verification: Google accounts are treated as verified. Do not send the email-confirm loop for this path.

---

## 7. Middleware and allow-list

Detect incomplete users with a `public.users` lookup by Auth uid (not `user_metadata`; that field is user-editable).

If session exists and **no** profile row:

**Allowed:** `/sign-up/complete` (GET + POST, including `signOutAction`), `POST /api/auth/complete-google-signup`, `/auth/callback`, `/legal/*`.

**Redirect to `/sign-up/complete`:** `/sign-in`, `/sign-up`, `/(app)/*`, and any other HTML app route.

**Blocked APIs:** other `/api/*` → `403` `{ code: "signup_incomplete" }`.

Complete page sign-out reuses `signOutAction` in `app/sign-in/actions.ts`, then `/sign-in` (no session).

If this lookup fails (Supabase error), fail closed: treat as unauthenticated for app routes (existing middleware catch).

---

## 8. Security

- BOLA: provision always uses session `auth.uid`. No client-supplied user id.
- Mass assignment: Zod `.strict()` on the complete body. Email/password not accepted.
- Terms: `accept_terms` must be literal `true`.
- Open redirects: keep `sanitizeAuthNextPath` on callback `next`.
- XSS: render Google email as text, not HTML.
- Do not authorize on `user_metadata` or `raw_user_meta_data`.
- Double submit: unique `public.users.id` (= Auth uid). Second request hits idempotent success.
- Generic API errors to the client; log details server-side.

---

## 9. Errors (user-facing)

| Code / case | Message |
|-------------|---------|
| `oauth_cancelled` | Google sign-in was cancelled. |
| `email_taken` | That Google email already belongs to a NiagaX account. Sign in with the original method. |
| `signup_incomplete` (API) | Finish creating your business first. |
| Session expired on complete | Sign in again with Google. |
| Validation | Stay on `/sign-up/complete` with field errors. |
| Standalone complete API | 403 signup disabled. |

Extend `socialAuthErrorMessage()` with `email_taken`. Keep `no_account` unused for this happy path (callback no longer signs out new Google users).

---

## 10. Testing

- Callback: profile exists → home; new email → complete; email taken → sign-in + sign-out.
- Complete API: happy path free + Solo trial (tier/status/credits match email sign-up); rejects extra body keys; ignores body email; 401 without session; 403 standalone; 409 email taken; idempotent second POST.
- Middleware: incomplete session cannot GET `/home` or `/api/finance/*`; can GET `/sign-up/complete`.
- UI: Google button on `/sign-up` when SaaS; hidden when `NEXT_PUBLIC_DEPLOYMENT_MODE=standalone`.
- `sanitizeAuthNextPath` unchanged.

---

## 11. Key files

- `app/auth/callback/route.ts` — branch new Google users to complete
- `app/sign-up/page.tsx` — Google button
- `app/sign-up/complete/page.tsx` — new form
- `app/api/auth/complete-google-signup/route.ts` — new
- `app/api/auth/sign-up/route.ts` — extract shared provision helper
- `lib/auth/schemas.ts` — `completeGoogleSignupSchema`
- `lib/auth/social-login.ts` — `email_taken` copy
- `middleware.ts` — incomplete-session gate
- `tests/auth/*` — callback, complete API, middleware, schema

---

*Decisions: Google on sign-up (A); incomplete Google from sign-in finishes the form (1); existing profile signs in (A); Google-first then complete form (approach 1).*
