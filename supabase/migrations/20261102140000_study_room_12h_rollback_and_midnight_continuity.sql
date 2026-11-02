-- Study Room: track per-session rank credits, roll abandoned sessions back after 12 hours,
-- and preserve active session elapsed time across Sri Lanka midnight.
-- Existing earned totals are not changed by midnight cleanup.

ALTER TABLE public.study_room_members
  ADD COLUMN IF NOT EXISTS session_today_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS session_today_date date NOT NULL DEFAULT (timezone('Asia/Colombo', now()))::date,
  ADD COLUMN IF NOT EXISTS session_week_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS session_week_start date NOT NULL DEFAULT
    ((timezone('Asia/Colombo', now()))::date -
      (extract(isodow FROM timezone('Asia/Colombo', now()))::integer - 1));

-- Keep the current daily/weekly rank totals visible, but hide the current session's
-- contribution immediately when its heartbeat has been absent for 12 hours.
-- Crucially, do not zero session_elapsed_seconds just because the date changed.
CREATE OR REPLACE VIEW public.study_room_live WITH (security_invoker = true) AS
WITH clock AS (
  SELECT
    timezone('Asia/Colombo', now())::date AS local_day,
    public.study_room_local_week_start(timezone('Asia/Colombo', now())::date) AS local_week
),
member_state AS (
  SELECT
    m.*,
    c.local_day,
    c.local_week,
    (
      m.is_studying
      AND (
        m.last_heartbeat_at IS NULL
        OR m.last_heartbeat_at <= now() - interval '12 hours'
      )
    ) AS idle_stale,
    (
      m.session_active
      AND NOT m.is_studying
      AND m.session_date IS DISTINCT FROM c.local_day
    ) AS paused_session_expired
  FROM public.study_room_members AS m
  CROSS JOIN clock AS c
),
visible_totals AS (
  SELECT
    s.*,
    CASE
      WHEN s.idle_stale AND s.today_date = s.session_today_date
        THEN greatest(coalesce(s.today_seconds, 0) - coalesce(s.session_today_seconds, 0), 0)
      ELSE coalesce(s.today_seconds, 0)
    END AS visible_today_seconds,
    CASE
      WHEN s.idle_stale AND s.week_start = s.session_week_start
        THEN greatest(coalesce(s.week_seconds, 0) - coalesce(s.session_week_seconds, 0), 0)
      ELSE coalesce(s.week_seconds, 0)
    END AS visible_week_seconds
  FROM member_state AS s
)
SELECT
  m.user_id,
  study_room_private.display_name_for_member(m.user_id) AS display_name,
  m.subject,
  CASE WHEN m.idle_stale THEN false ELSE m.is_studying END AS is_studying,
  CASE WHEN m.idle_stale OR m.paused_session_expired THEN NULL::timestamptz ELSE m.session_started_at END AS session_started_at,
  CASE WHEN m.idle_stale OR m.paused_session_expired THEN NULL::timestamptz ELSE m.last_heartbeat_at END AS last_heartbeat_at,
  m.visible_today_seconds AS today_seconds,
  m.today_date,
  m.visible_week_seconds AS week_seconds,
  m.week_start,
  m.updated_at,
  study_room_private.gender_for_member(m.user_id) AS gender,
  CASE
    WHEN m.today_date = m.local_day THEN
      lpad((m.visible_today_seconds / 3600)::text, 2, '0') || ':' ||
      lpad(((m.visible_today_seconds % 3600) / 60)::text, 2, '0') || ':' ||
      lpad((m.visible_today_seconds % 60)::text, 2, '0')
    ELSE '00:00:00'::text
  END AS today_time,
  CASE
    WHEN m.week_start = m.local_week THEN
      lpad((m.visible_week_seconds / 3600)::text, 2, '0') || ':' ||
      lpad(((m.visible_week_seconds % 3600) / 60)::text, 2, '0') || ':' ||
      lpad((m.visible_week_seconds % 60)::text, 2, '0')
    ELSE '00:00:00'::text
  END AS week_time,
  CASE
    WHEN m.idle_stale OR m.paused_session_expired THEN 0
    ELSE coalesce(m.session_elapsed_seconds, 0)
  END AS session_elapsed_seconds,
  CASE
    WHEN m.idle_stale OR m.paused_session_expired THEN m.local_day
    ELSE m.session_date
  END AS session_date,
  CASE
    WHEN m.idle_stale OR m.paused_session_expired THEN false
    ELSE m.session_active
  END AS session_active
FROM visible_totals AS m
WHERE study_room_private.profile_is_complete(m.user_id);

REVOKE ALL ON public.study_room_live FROM public, anon, authenticated;
GRANT SELECT ON public.study_room_live TO authenticated;

-- At the 12-hour no-heartbeat boundary, remove every contribution from that
-- abandoned session in the current daily and weekly buckets. Do not credit the
-- unobserved interval after the last heartbeat.
CREATE OR REPLACE FUNCTION public.study_room_pause_stale_sessions(p_user_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  member_row public.study_room_members%rowtype;
  reference_now timestamptz := now();
  local_day date := timezone('Asia/Colombo', now())::date;
  monday date := public.study_room_local_week_start(timezone('Asia/Colombo', now())::date);
BEGIN
  FOR member_row IN
    SELECT *
    FROM public.study_room_members
    WHERE is_studying = true
      AND (p_user_id IS NULL OR user_id = p_user_id)
      AND (
        last_heartbeat_at IS NULL
        OR last_heartbeat_at <= reference_now - interval '12 hours'
      )
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.study_room_members
    SET
      today_seconds = CASE
        WHEN today_date = session_today_date
          THEN greatest(coalesce(today_seconds, 0) - coalesce(session_today_seconds, 0), 0)
        ELSE coalesce(today_seconds, 0)
      END,
      week_seconds = CASE
        WHEN week_start = session_week_start
          THEN greatest(coalesce(week_seconds, 0) - coalesce(session_week_seconds, 0), 0)
        ELSE coalesce(week_seconds, 0)
      END,
      is_studying = false,
      session_active = false,
      session_started_at = NULL,
      last_heartbeat_at = NULL,
      session_elapsed_seconds = 0,
      session_date = local_day,
      session_today_seconds = 0,
      session_today_date = local_day,
      session_week_seconds = 0,
      session_week_start = monday,
      updated_at = reference_now
    WHERE user_id = member_row.user_id;
  END LOOP;
END;
$function$;

-- Heartbeats credit exact elapsed time into the current Sri Lanka day/week and
-- also track which part of those totals belongs to this specific session.
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
  next_today integer;
  next_week integer;
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
        session_today_seconds = 0,
        session_today_date = timezone('Asia/Colombo', now())::date,
        session_week_seconds = 0,
        session_week_start = public.study_room_local_week_start(timezone('Asia/Colombo', now())::date),
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
  elapsed_week := greatest(0, floor(extract(epoch FROM (reference_now - greatest(previous.last_heartbeat_at, week_start_ts)))::integer);

  next_today := CASE
    WHEN previous.today_date = local_day THEN coalesce(previous.today_seconds, 0) + elapsed_today
    ELSE elapsed_today
  END;
  next_week := CASE
    WHEN previous.week_start = monday THEN coalesce(previous.week_seconds, 0) + elapsed_week
    ELSE elapsed_week
  END;

  UPDATE public.study_room_members
  SET
    today_seconds = next_today,
    today_date = local_day,
    today_time = lpad((next_today / 3600)::text, 2, '0') || ':' ||
      lpad(((next_today % 3600) / 60)::text, 2, '0') || ':' ||
      lpad((next_today % 60)::text, 2, '0'),
    week_seconds = next_week,
    week_start = monday,
    week_time = lpad((next_week / 3600)::text, 2, '0') || ':' ||
      lpad(((next_week % 3600) / 60)::text, 2, '0') || ':' ||
      lpad((next_week % 60)::text, 2, '0'),
    session_elapsed_seconds = coalesce(previous.session_elapsed_seconds, 0) + elapsed_total,
    session_date = local_day,
    session_today_seconds = CASE
      WHEN previous.session_today_date = local_day
        THEN coalesce(previous.session_today_seconds, 0) + elapsed_today
      ELSE elapsed_today
    END,
    session_today_date = local_day,
    session_week_seconds = CASE
      WHEN previous.session_week_start = monday
        THEN coalesce(previous.session_week_seconds, 0) + elapsed_week
      ELSE elapsed_week
    END,
    session_week_start = monday,
    last_heartbeat_at = reference_now,
    updated_at = reference_now
  WHERE user_id = uid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.study_room_start()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  local_day date := timezone('Asia/Colombo', now())::date;
  monday date := public.study_room_local_week_start(timezone('Asia/Colombo', now())::date);
  current_member public.study_room_members%rowtype;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
  IF NOT study_room_private.profile_is_complete(uid) THEN
    RAISE EXCEPTION 'Complete your StudyLab profile before entering the Live Study Room.';
  END IF;

  PERFORM public.study_room_heartbeat();

  SELECT * INTO current_member
  FROM public.study_room_members
  WHERE user_id = uid
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Create a profile first'; END IF;
  IF current_member.is_studying THEN RETURN; END IF;

  UPDATE public.study_room_members
  SET
    is_studying = true,
    session_active = true,
    session_elapsed_seconds = CASE
      WHEN current_member.session_active AND current_member.session_date = local_day
        THEN coalesce(current_member.session_elapsed_seconds, 0)
      ELSE 0
    END,
    session_date = local_day,
    session_today_seconds = CASE
      WHEN current_member.session_active
        AND current_member.session_date = local_day
        AND current_member.session_today_date = local_day
        THEN coalesce(current_member.session_today_seconds, 0)
      ELSE 0
    END,
    session_today_date = local_day,
    session_week_seconds = CASE
      WHEN current_member.session_active
        AND current_member.session_date = local_day
        AND current_member.session_week_start = monday
        THEN coalesce(current_member.session_week_seconds, 0)
      ELSE 0
    END,
    session_week_start = monday,
    session_started_at = now(),
    last_heartbeat_at = now(),
    updated_at = now()
  WHERE user_id = uid;
END;
$function$;

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
  monday date := public.study_room_local_week_start(timezone('Asia/Colombo', now())::date);
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
  PERFORM public.study_room_heartbeat();

  UPDATE public.study_room_members
  SET is_studying = false,
      session_active = false,
      session_started_at = NULL,
      session_elapsed_seconds = 0,
      session_date = local_day,
      session_today_seconds = 0,
      session_today_date = local_day,
      session_week_seconds = 0,
      session_week_start = monday,
      last_heartbeat_at = NULL,
      updated_at = CASE WHEN is_studying THEN now() ELSE updated_at END
  WHERE user_id = uid;
END;
$function$;

-- Midnight cleanup only ends sessions that were already paused on an earlier
-- local date. Active sessions are never paused or reset by this job.
DO $schedule$
DECLARE
  existing_job bigint;
BEGIN
  FOR existing_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN ('study-room-pause-stale-sessions', 'study-room-expire-paused-sessions')
  LOOP
    PERFORM cron.unschedule(existing_job);
  END LOOP;

  PERFORM cron.schedule(
    'study-room-pause-stale-sessions',
    '* * * * *',
    'SELECT public.study_room_pause_stale_sessions();'
  );

  PERFORM cron.schedule(
    'study-room-expire-paused-sessions',
    '* * * * *',
    $job$
      UPDATE public.study_room_members
      SET is_studying = false,
          session_active = false,
          session_started_at = NULL,
          last_heartbeat_at = NULL,
          session_elapsed_seconds = 0,
          session_date = timezone('Asia/Colombo', now())::date,
          session_today_seconds = 0,
          session_today_date = timezone('Asia/Colombo', now())::date,
          session_week_seconds = 0,
          session_week_start = public.study_room_local_week_start(timezone('Asia/Colombo', now())::date),
          updated_at = now()
      WHERE is_studying = false
        AND session_active = true
        AND session_date IS DISTINCT FROM timezone('Asia/Colombo', now())::date;
    $job$
  );
END;
$schedule$;

REVOKE ALL ON FUNCTION public.study_room_pause_stale_sessions(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.study_room_heartbeat() FROM public, anon;
REVOKE ALL ON FUNCTION public.study_room_start() FROM public, anon;
REVOKE ALL ON FUNCTION public.study_room_pause() FROM public, anon;
REVOKE ALL ON FUNCTION public.study_room_end() FROM public, anon;

GRANT EXECUTE ON FUNCTION public.study_room_heartbeat() TO authenticated;
GRANT EXECUTE ON FUNCTION public.study_room_start() TO authenticated;
GRANT EXECUTE ON FUNCTION public.study_room_pause() TO authenticated;
GRANT EXECUTE ON FUNCTION public.study_room_end() TO authenticated;
