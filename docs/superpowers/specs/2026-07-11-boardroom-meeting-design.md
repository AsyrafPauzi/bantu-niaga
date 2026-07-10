# AI Boardroom — Meeting Room Design

> **Status:** Approved 2026-07-11 — implement  
> **Depends on:** Maya, Hana, Sufi live chat

---

## 1. Goals

Replace the demo Boardroom UI with a real **meeting room**: pick attendees, ask questions, staff-style agents (silent / clarify / plan), pause/resume/end, history + PDF export.

---

## 2. Locked decisions

| Topic | Choice |
|-------|--------|
| Attendees | Pick every meeting before Start |
| Min invite | ≥ 2 live agents |
| v1 inviteable | Maya, Hana, Sufi (when activated); more when their chat ships |
| Staff behaviour | Related → speak; unsure → clarify; unrelated → silent |
| Clarifiers | One combined room questions card (free) |
| Credits | 1 per speaking agent; silent/clarify/synthesis free |
| Create | After confirm: Maya drafts + Sufi lead note/chase; Hana advise-only in room |
| Access | Owner + manager |
| Pause | 1 paused meeting max |
| End | Completed history; Export PDF |
| Start new | Confirmation popup |

---

## 3. Data model

### `boardroom_meetings`
- id, business_id, created_by
- status: `setup` | `active` | `paused` | `ended`
- invited_agent_ids: text[] (e.g. marketing, hr, sales)
- title: text null
- credits_spent: int default 0
- created_at, updated_at, ended_at, paused_at

### `boardroom_messages`
- id, meeting_id, business_id
- role: `user` | `agent` | `room_clarifier` | `synth` | `system`
- agent_id: text null
- content: text
- meta: jsonb null (credits, silent flags, etc.)
- created_at

RLS: tenant-scoped; insert/update for owner/manager.

---

## 4. APIs

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/boardroom/meetings` | List history + current paused/active |
| POST | `/api/boardroom/meetings` | Start meeting (invite ≥2) |
| GET | `/api/boardroom/meetings/[id]` | Meeting + messages |
| PATCH | `/api/boardroom/meetings/[id]` | pause / resume / end |
| POST | `/api/boardroom/meetings/[id]/message` | User turn → clarify or agent run |
| GET | `/api/boardroom/meetings/[id]/pdf` | PDF export |

---

## 5. Success criteria

1. Owner picks ≥2 of Maya/Hana/Sufi → Start  
2. Unrelated agents stay silent (no credit)  
3. Combined clarifier free; speaking agents charge 1 each  
4. Pause → Resume; Start new confirms  
5. End → history + PDF download
