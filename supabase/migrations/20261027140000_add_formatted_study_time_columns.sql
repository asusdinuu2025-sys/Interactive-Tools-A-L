ALTER TABLE public.study_room_members
  ADD COLUMN IF NOT EXISTS today_time text
  GENERATED ALWAYS AS (
    lpad((today_seconds / 3600)::text, 2, '0') || ':' ||
    lpad(((today_seconds % 3600) / 60)::text, 2, '0') || ':' ||
    lpad((today_seconds % 60)::text, 2, '0')
  ) STORED;

ALTER TABLE public.study_room_members
  ADD COLUMN IF NOT EXISTS week_time text
  GENERATED ALWAYS AS (
    lpad((week_seconds / 3600)::text, 2, '0') || ':' ||
    lpad(((week_seconds % 3600) / 60)::text, 2, '0') || ':' ||
    lpad((week_seconds % 60)::text, 2, '0')
  ) STORED;

CREATE OR REPLACE VIEW public.study_room_live
WITH (security_invoker = true) AS
SELECT
  m.user_id,
  study_room_private.display_name_for_member(m.user_id) AS display_name,
  m.subject,
  m.is_studying,
  m.session_started_at,
  m.last_heartbeat_at,
  m.today_seconds,
  m.today_date,
  m.week_seconds,
  m.week_start,
  m.updated_at,
  study_room_private.gender_for_member(m.user_id) AS gender,
  m.today_time,
  m.week_time
FROM public.study_room_members m;

REVOKE ALL ON public.study_room_live FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.study_room_live TO authenticated;