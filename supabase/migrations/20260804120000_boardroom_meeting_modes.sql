-- Boardroom meeting modes: normal vs depth deliberation.

alter table public.boardroom_meetings
  add column if not exists meeting_mode text not null default 'normal'
    check (meeting_mode in ('normal', 'depth'));

alter table public.boardroom_meetings
  add column if not exists depth_state jsonb;

comment on column public.boardroom_meetings.meeting_mode is
  'normal = single-pass; depth = multi-round debate until confident.';

comment on column public.boardroom_meetings.depth_state is
  'Depth mode state: round, confidence, credits_since_checkpoint, paused_at_checkpoint, owner_constraint.';
