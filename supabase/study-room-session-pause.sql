-- Apply once after deploying the matching Study Room client update.
-- Preserves a same-day paused session while keeping daily/weekly totals intact.
ALTER TABLE public.study_room_members
  ADD COLUMN IF NOT EXISTS session_elapsed_seconds integer NOT NULL DEFAULT 0
    CHECK (session_elapsed_seconds >= 0);
ALTER TABLE public.study_room_members
  ADD COLUMN IF NOT EXISTS session_date date NOT NULL
    DEFAULT (timezone('Asia/Colombo', now())::date);

UPDATE public.study_room_members
SET session_date = timezone('Asia/Colombo', now())::date
WHERE session_date IS NULL;

create or replace view public.study_room_live
with (security_invoker = true) as
select m.user_id,
       study_room_private.display_name_for_member(m.user_id) as display_name,
       m.subject, m.is_studying, m.session_started_at, m.last_heartbeat_at,
       m.today_seconds, m.today_date, m.week_seconds, m.week_start, m.updated_at,
       study_room_private.gender_for_member(m.user_id) as gender,
       case when m.today_date = timezone('Asia/Colombo', now())::date
            then m.today_time else '00:00:00' end as today_time,
       case when m.week_start = public.study_room_local_week_start(timezone('Asia/Colombo', now())::date)
            then m.week_time else '00:00:00' end as week_time,
       m.session_elapsed_seconds,
       m.session_date
from public.study_room_members m
where study_room_private.profile_is_complete(m.user_id);
revoke all on public.study_room_live from public, anon, authenticated;
grant select on public.study_room_live to authenticated;

CREATE OR REPLACE FUNCTION public.study_room_start()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  local_day date := timezone('Asia/Colombo', now())::date;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
  IF NOT study_room_private.profile_is_complete(uid) THEN
    RAISE EXCEPTION 'Complete your StudyLab profile before entering the Live Study Room.';
  END IF;

  UPDATE public.study_room_members
  SET is_studying = true,
      session_elapsed_seconds = CASE
        WHEN session_date = local_day THEN session_elapsed_seconds ELSE 0 END,
      session_date = local_day,
      session_started_at = now(),
      last_heartbeat_at = now(),
      updated_at = now()
  WHERE user_id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Create a profile first'; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.study_room_heartbeat()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  local_day date := timezone('Asia/Colombo', now())::date;
  monday date := public.study_room_local_week_start(timezone('Asia/Colombo', now())::date);
  elapsed integer;
  previous public.study_room_members%rowtype;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;

  IF NOT study_room_private.profile_is_complete(uid) THEN
    UPDATE public.study_room_members
    SET is_studying = false, session_started_at = NULL,
        last_heartbeat_at = NULL, updated_at = now()
    WHERE user_id = uid;
    RETURN;
  END IF;

  SELECT * INTO previous
  FROM public.study_room_members
  WHERE user_id = uid
  FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  IF previous.is_studying AND previous.last_heartbeat_at IS NOT NULL THEN
    elapsed := greatest(0, least(90,
      floor(extract(epoch FROM (now() - previous.last_heartbeat_at)))::integer));

    IF now() - previous.last_heartbeat_at > interval '90 seconds' THEN
      -- A missing heartbeat means the tab was closed or disconnected.
      -- Save only the bounded final interval, then pause the session.
      UPDATE public.study_room_members
      SET today_seconds = CASE WHEN today_date = local_day
            THEN today_seconds + elapsed ELSE 0 END,
          today_date = local_day,
          week_seconds = CASE WHEN week_start = monday
            THEN week_seconds + elapsed ELSE 0 END,
          week_start = monday,
          session_elapsed_seconds = CASE
            WHEN session_date = local_day
              THEN session_elapsed_seconds + greatest(0,
                floor(extract(epoch FROM (now() - previous.session_started_at)))::integer)
            ELSE 0 END,
          session_date = local_day,
          is_studying = false,
          session_started_at = NULL,
          last_heartbeat_at = NULL,
          updated_at = now()
      WHERE user_id = uid;
      RETURN;
    END IF;

    -- Normal heartbeat: credit the short active interval to daily and weekly totals.
    UPDATE public.study_room_members
    SET today_seconds = CASE WHEN today_date = local_day
          THEN today_seconds + elapsed ELSE elapsed END,
        today_date = local_day,
        week_seconds = CASE WHEN week_start = monday
          THEN week_seconds + elapsed ELSE elapsed END,
        week_start = monday,
        last_heartbeat_at = now(),
        updated_at = now()
    WHERE user_id = uid;
    RETURN;
  END IF;

  -- Paused sessions are resumable only on the same Sri Lankan calendar day.
  UPDATE public.study_room_members
  SET today_seconds = CASE WHEN today_date = local_day THEN today_seconds ELSE 0 END,
      today_date = local_day,
      week_seconds = CASE WHEN week_start = monday THEN week_seconds ELSE 0 END,
      week_start = monday,
      session_elapsed_seconds = CASE
        WHEN session_date = local_day THEN session_elapsed_seconds ELSE 0 END,
      session_date = local_day,
      updated_at = now()
  WHERE user_id = uid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.study_room_leave()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
  PERFORM public.study_room_heartbeat();
  UPDATE public.study_room_members
  SET is_studying = false,
      session_started_at = NULL,
      session_elapsed_seconds = 0,
      session_date = timezone('Asia/Colombo', now())::date,
      last_heartbeat_at = NULL,
      updated_at = now()
  WHERE user_id = uid;
END;
$function$;

REVOKE ALL ON FUNCTION public.study_room_start() FROM public, anon;
REVOKE ALL ON FUNCTION public.study_room_heartbeat() FROM public, anon;
REVOKE ALL ON FUNCTION public.study_room_leave() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.study_room_start() TO authenticated;
GRANT EXECUTE ON FUNCTION public.study_room_heartbeat() TO authenticated;
GRANT EXECUTE ON FUNCTION public.study_room_leave() TO authenticated;
