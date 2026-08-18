# SMTP & Email Setup (Production)

This guide covers transactional email for **Supabase Auth** (sign-up, password reset, team invites) and **app email** (Marketing broadcasts, Boardroom weekly digest).

## Overview

| Channel | Provider | Env vars | Used for |
|---------|----------|----------|----------|
| Supabase Auth | Custom SMTP (Resend recommended) | Supabase Dashboard → Auth → SMTP | Team invites, magic links, password reset |
| App email | Resend HTTP API | `RESEND_API_KEY`, `MARKETING_FROM_EMAIL` | Marketing broadcasts, Boardroom weekly digest |

Both can use the same Resend account and verified sender domain.

---

## 1. Resend setup

1. Create a project at [resend.com](https://resend.com).
2. Add and verify your sending domain (DNS: SPF, DKIM, optional DMARC).
3. Create an API key with **Sending access**.
4. Choose a From address on the verified domain, e.g. `Bantu Niaga <hello@yourdomain.com>`.

### Vercel / production env

Set in your hosting provider (and locally in `.env.local`):

```bash
RESEND_API_KEY=re_xxxxxxxx
MARKETING_FROM_EMAIL="Bantu Niaga <hello@yourdomain.com>"
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
```

`MARKETING_FROM_EMAIL` must match a verified sender in Resend. Without these, Marketing email broadcasts and the Boardroom weekly digest cron skip sending (412 / logged warning).

Optional — enforce verified email before sign-in:

```bash
AUTH_REQUIRE_EMAIL_VERIFICATION=true
```

Only enable after Supabase Auth SMTP is working.

---

## 2. Supabase Auth SMTP (team invites & auth emails)

Team invites use `auth.admin.inviteUserByEmail()` (`POST /api/settings/team/invite`). Supabase sends the invite email — **not** the app Resend client.

### Configure in Supabase Dashboard

1. **Project Settings → Authentication → SMTP Settings**
2. Enable **Custom SMTP**
3. Use Resend SMTP (or your provider):

| Field | Resend value |
|-------|----------------|
| Host | `smtp.resend.com` |
| Port | `465` (SSL) or `587` (TLS) |
| Username | `resend` |
| Password | Your `RESEND_API_KEY` |
| Sender email | Same address as `MARKETING_FROM_EMAIL` (verified domain) |
| Sender name | `NiagaX` |

4. **Authentication → URL Configuration**
   - **Site URL**: `https://app.yourdomain.com` (must match `NEXT_PUBLIC_APP_URL`)
   - **Redirect URLs**: include  
     `https://app.yourdomain.com/auth/callback`  
     `https://app.yourdomain.com/accept-invite`

### Send Email hook (NiagaX HTML)

Auth HTML (confirm, reset, invite, magic link, email change) is sent by the app via Resend, not GoTrue’s built-in template.

1. Set Vercel `AUTH_SEND_EMAIL_HOOK_SECRET` to the secret Supabase shows when creating the hook (`v1,whsec_…`). Production and Preview.
2. Authentication → Hooks → Send Email → HTTPS `https://app.niagax.my/api/webhooks/auth-send-email`.
3. After the hook is on, GoTrue does not send its own HTML. Leave dashboard templates with: `Handled by NiagaX Send Email hook.`
4. Confirm in Resend: From `noreply@app.niagax.my`, one mail per reset, not `noreply@mail.app.supabase.io`.
5. Appearance → Bahasa Melayu, then reset, to verify Malay copy.

Invite link redirect: the app sets `redirectTo` to `/auth/callback?next=/accept-invite` so invitees land on the password-setup page.

---

## 3. Team invite flow (checklist)

1. Owner opens **Settings → Team → Invite**.
2. API creates `team_invites` row and calls `inviteUserByEmail`.
3. Supabase sends invite email via SMTP.
4. Invitee clicks link → Supabase session → `/accept-invite`.
5. Invitee sets password via `POST /api/auth/accept-invite`.

### Local development

Without SMTP, invites still create a `team_invites` row. In development the API may return `dev_invite_link` in the JSON response (copy from the Team UI). Configure SMTP before production go-live.

### Verify production

1. Invite a test email from Settings → Team.
2. Confirm invite email arrives (check spam).
3. Complete `/accept-invite` and sign in.
4. Confirm `invite_email_sent: true` in the API response (no `dev_invite_link`).

---

## 4. App email (Resend API)

These routes use `lib/marketing/email-resend.ts` directly:

| Feature | Route / cron |
|---------|----------------|
| Marketing broadcasts | `POST /api/marketing/broadcasts/[id]/send` |
| Boardroom weekly digest | `GET /api/cron/boardroom-weekly-digest` (Sundays, `vercel.json`) |

Cron auth: `Authorization: Bearer $CRON_SECRET`.

---

## 5. Environment variable reference

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_APP_URL` | Yes | Public app URL; used in invite redirects and invoice share links |
| `RESEND_API_KEY` | For app email | Resend API key |
| `MARKETING_FROM_EMAIL` | For app email | Verified From header |
| `CRON_SECRET` | For crons | Vercel Cron `Authorization` header |
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | Optional | `true` after Auth SMTP works |

Supabase Auth SMTP is configured in the **Supabase Dashboard**, not via repo env vars.

---

## 6. Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Invite API succeeds but no email | Supabase custom SMTP not enabled or wrong credentials |
| `dev_invite_link` in production | SMTP misconfigured; Supabase fell back to dev behaviour |
| Broadcast / digest `email_channel_not_configured` | Missing `RESEND_API_KEY` or `MARKETING_FROM_EMAIL` |
| Invite link goes to wrong host | `NEXT_PUBLIC_APP_URL` or Supabase Site URL mismatch |
| Emails in spam | Complete domain verification (SPF/DKIM) in Resend |

For Auth delivery logs: **Supabase Dashboard → Authentication → Logs**.  
For Resend delivery: **Resend Dashboard → Emails**.
