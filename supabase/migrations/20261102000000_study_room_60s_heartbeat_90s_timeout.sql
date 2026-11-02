-- Study Room: 60-second heartbeat, 90-second inactivity pause, and Sri Lanka midnight cleanup.
-- Preserve existing daily/weekly ranking architecture and never clear earned totals during idle cleanup.

CREATE OR REPLACE VIEW public.study_room_live WITH (security_invoker = true) AS
WITH member_state AS (
  SELECT
    m.*,
    (
      m.is_studying
      AND (
        m.last_heartbeat_at IS NULL
        OR m.last_heartbeat_at <= now() - interval '90 seconds'
      )
    ) AS idle_stale
  FROM public.study_room_members AS m
)
SELECT
  m.user_id,
  study_room_private.display_name_for_member(m.user_id) AS display_name,
  m.subject,
  CASE WHEN m.idle_stale THEN false ELSE m.is_studying END AS is_studying,
  CASE WHEN m.idle_stale THEN NULL::timestamptz ELSE m.session_started_at END AS session_started_at,
  CASE WHEN m.idle_stale THEN NULL::timestamptz ELSE m.last_heartbeat_at END AS last_heartbeat_at,
  m.today_seconds,
  m.today_date,
  m.week_seconds,
  m.week_start,
  m.updated_at,
  study_room_private.gender_for_member(m.user_id) AS gender,
  CASE
    WHEN m.today_date = timezone('Asia/Colombo', now())::date THEN m.today_time
    ELSE '00:00:00'::text
  END AS today_time,
  CASE
    WHEN m.week_start = public.study_room_local_week_start(timezone('Asia/Colombo', now())::date) THEN m.week_time
    ELSE '00:00:00'::text
  END AS week_time,
  m.session_elapsed_seconds,
  m.session_date,
  CASE WHEN m.idle_stale THEN true ELSE m.session_active END AS session_active
FROM member_state AS m
WHERE study_room_private.profile_is_complete(m.user_id);

REVOKE ALL ON public.study_room_live FROM public, anon, authenticated;
GRANT SELECT ON public.study_room_live TO authenticated;

-- Pause stale running sessions and credit no more than the 90-second grace window.
-- Do not advance session_date here: midnight cleanup must still recognize a session
-- abandoned on the previous local day.
CREATE OR REPLACE FUNCTION public.study_room_pause_stale_sessions(p_user_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  member_row public.study_room_members%rowtype;
  reference_now timestamptz := now();
  credit_until timestamptz;
  local_day date;
  monday date;
  day_start timestamptz;
  week_start_ts timestamptz;
  elapsed_total integer;
  elapsed_today integer;
  elapsed_week integer;
BEGIN
  FOR member_row IN
    SELECT *
    FROM public.study_room_members
    WHERE is_studying = true
      AND (p_user_id IS NULL OR user_id = p_user_id)
      AND (
        last_heartbeat_at IS NULL
        OR last_heartbeat_at <= reference_now - interval '90 seconds'
      )
    FOR UPDATE SKIP LOCKED
  LOOP
    IF member_row.last_heartbeat_at IS NULL THEN
      UPDATE public.study_room_members
      SET is_studying = false,
          session_active = true,
          session_started_at = NULL,
          last_heartbeat_at = NULL,
          updated_at = reference_now
      WHERE user_id = member_row.user_id;
      CONTINUE;
    END IF;

    -- Never credit time beyond the timeout or beyond midnight without a new heartbeat.
    credit_until := LEAST(
      reference_now,
      member_row.last_heartbeat_at + interval '90 seconds',
      ((timezone('Asia/Colombo', member_row.last_heartbeat_at)::date + 1)::timestamp AT TIME ZONE 'Asia/Colombo')
    );
    local_day := timezone('Asia/Colombo', credit_until)::date;
    monday := public.study_room_local_week_start(local_day);
    day_start := (local_day::timestamp AT TIME ZONE 'Asia/Colombo');
    week_start_ts := (monday::timestamp AT TIME ZONE 'Asia/Colombo');

    elapsed_total := greatest(0, floor(extract(epoch FROM (credit_until - member_row.last_heartbeat_at)))::integer);
    elapsed_today := greatest(0, floor(extract(epoch FROM (credit_until - greatest(member_row.last_heartbeat_at, day_start)))::integer));
    elapsed_week := greatest(0, floor(extract(epoch FROM (credit_until - greatest(member_row.last_heartbeat_at, week_start_ts)))::integer));

    UPDATE public.study_room_members
    SET today_seconds = CASE
          WHEN today_date = local_day THEN today_seconds + elapsed_today
          ELSE elapsed_today
        END,
        today_date = local_day,
        week_seconds = CASE
          WHEN week_start = monday THEN week_seconds + elapsed_week
          ELSE elapsed_week
        END,
        week_start = monday,
        session_elapsed_seconds = coalesce(session_elapsed_seconds, 0) + elapsed_total,
        is_studying = false,
        session_active = true,
        session_started_at = NULL,
        last_heartbeat_at = NULL,
        -- Match the local tracker to the exact server-side credited endpoint.
        updated_at = credit_until
    WHERE user_id = member_row.user_id;
  END LOOP;
END;
$function$;

-- Called by the heartbeat RPC and the scheduled maintenance job.
CREATE OR REPLACE FUNCTION public.study_room_heartbeat()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  reference_now timestamptz := now();
  local_day date := timezone('Asia/Colombo', now())::date;
  monday date := public.study_room_local_week_start(timezone('Asia/Colombo', now())::date);
  day_start timestamptz := (timezone('Asia/Colombo', now())::date::timestamp AT TIME ZONE 'Asia/Colombo');
  week_start_ts timestamptz;
  elapsed_total integer;
  elapsed_today integer;
  elapsed_week integer;
  previous public.study_room_members%rowtype;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;

  PERFORM public.study_room_pause_stale_sessions(uid);

  IF NOT study_room_private.profile_is_complete(uid) THEN
    UPDATE public.study_room_members
    SET is_studying = false,
        session_active = false,
        session_started_at = NULL,
        session_elapsed_seconds = 0,
        last_heartbeat_at = NULL,
        updated_at = reference_now
    WHERE user_id = uid;
    RETURN;
  END IF;

  week_start_ts := (monday::timestamp AT TIME ZONE 'Asia/Colombo');
  SELECT * INTO previous
  FROM public.study_room_members
  WHERE user_id = uid
  FOR UPDATE;

  IF NOT FOUND OR NOT previous.is_studying THEN RETURN; END IF;
  IF previous.last_heartbeat_at IS NULL THEN
    UPDATE public.study_room_members
    SET last_heartbeat_at = reference_now, updated_at = reference_now
    WHERE user_id = uid;
    RETURN;
  END IF;

  elapsed_total := greatest(0, floor(extract(epoch FROM (reference_now - previous.last_heartbeat_at)))::integer);
  elapsed_today := greatest(0, floor(extract(epoch FROM (reference_now - greatest(previous.last_heartbeat_at, day_start)))::integer));
  elapsed_week := greatest(0, floor(extract(epoch FROM (reference_now - greatest(previous.last_heartbeat_at, week_start_ts)))::integer));

  UPDATE public.study_room_members
  SET today_seconds = CASE
        WHEN today_date = local_day THEN today_seconds + elapsed_today
        ELSE elapsed_today
      END,
      today_date = local_day,
      week_seconds = CASE
        WHEN week_start = monday THEN week_seconds + elapsed_week
        ELSE elapsed_week
      END,
      week_start = monday,
      -- Keep one continuous session counter across daily and weekly boundaries.
      session_elapsed_seconds = coalesce(session_elapsed_seconds, 0) + elapsed_total,
      session_date = local_day,
      last_heartbeat_at = reference_now,
      updated_at = reference_now
  WHERE user_id = uid;
END;
$function$;

-- Preserve the exact stale-session credit endpoint if a returning student presses End.
-- A normal active Pause/End still records the current server time.
CREATE OR REPLACE FUNCTION public.study_room_pause()
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
      session_active = true,
      session_started_at = NULL,
      last_heartbeat_at = NULL,
      updated_at = CASE WHEN is_studying THEN now() ELSE updated_at END
  WHERE user_id = uid
    AND session_active = true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.study_room_end()
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

  PERFORM public.study_room_heartbeat();

  UPDATE public.study_room_members
  SET is_studying = false,
      session_active = false,
      session_started_at = NULL,
      session_elapsed_seconds = 0,
      session_date = local_day,
      last_heartbeat_at = NULL,
      updated_at = CASE WHEN is_studying THEN now() ELSE updated_at END
  WHERE user_id = uid;
END;
$function$;

-- Clear only paused sessions from a previous Sri Lanka calendar day.
-- Daily and weekly ranking totals are deliberately not touched here.
CREATE OR REPLACE FUNCTION public.study_room_run_maintenance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  local_day date := timezone('Asia/Colombo', now())::date;
BEGIN
  PERFORM public.study_room_pause_stale_sessions();

  UPDATE public.study_room_members
  SET is_studying = false,
      session_active = false,
      session_started_at = NULL,
      last_heartbeat_at = NULL,
      session_elapsed_seconds = 0,
      session_date = local_day
  WHERE is_studying = false
    AND session_active = true
    AND session_date < local_day;
END;
$function$;

REVOKE ALL ON FUNCTION public.study_room_pause_stale_sessions(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.study_room_run_maintenance() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.study_room_heartbeat() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.study_room_heartbeat() TO authenticated;

-- Replace the old 24-hour expiry job. The new job pauses stale sessions and
-- clears only paused sessions that belong to an earlier Sri Lanka calendar day.
DO $schedule$
DECLARE
  existing_job bigint;
BEGIN
  FOR existing_job IN
    SELECT jobid FROM cron.job WHERE jobname = 'study-room-expire-idle-sessions'
  LOOP
    PERFORM cron.unschedule(existing_job);
  END LOOP;

  PERFORM cron.schedule(
    'study-room-expire-idle-sessions',
    '* * * * *',
    'SELECT public.study_room_run_maintenance();'
  );
END;
$schedule$;
