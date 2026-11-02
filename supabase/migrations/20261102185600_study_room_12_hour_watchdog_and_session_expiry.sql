-- Recovered from the applied Supabase migration ledger on 2026-11-02.
-- Original SQL statements are preserved from supabase_migrations.schema_migrations.

CREATE OR REPLACE FUNCTION public.study_room_pause_stale_sessions(p_user_id uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  member_row public.study_room_members%rowtype;
  reference_now timestamptz := now();
  credit_until timestamptz;
  credit_day date;
  current_day date := timezone('Asia/Colombo', now())::date;
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
      AND (last_heartbeat_at IS NULL OR last_heartbeat_at <= reference_now - interval '12 hours')
    FOR UPDATE SKIP LOCKED
  LOOP
    IF member_row.last_heartbeat_at IS NULL THEN
      UPDATE public.study_room_members
      SET is_studying = false,
          session_active = coalesce(session_date = current_day, false),
          session_started_at = NULL,
          last_heartbeat_at = NULL,
          session_elapsed_seconds = CASE WHEN session_date = current_day
            THEN coalesce(session_elapsed_seconds, 0) ELSE 0 END,
          session_date = CASE WHEN session_date = current_day THEN session_date ELSE current_day END,
          updated_at = reference_now
      WHERE user_id = member_row.user_id;
      CONTINUE;
    END IF;

    credit_day := timezone('Asia/Colombo', member_row.last_heartbeat_at)::date;
    credit_until := LEAST(
      reference_now,
      member_row.last_heartbeat_at + interval '12 hours',
      ((credit_day + 1)::timestamp AT TIME ZONE 'Asia/Colombo')
    );
    monday := public.study_room_local_week_start(credit_day);
    day_start := (credit_day::timestamp AT TIME ZONE 'Asia/Colombo');
    week_start_ts := (monday::timestamp AT TIME ZONE 'Asia/Colombo');

    elapsed_total := greatest(0, floor(extract(epoch FROM (credit_until - member_row.last_heartbeat_at)))::integer);
    elapsed_today := greatest(0, floor(extract(epoch FROM (credit_until - greatest(member_row.last_heartbeat_at, day_start)))::integer));
    elapsed_week := greatest(0, floor(extract(epoch FROM (credit_until - greatest(member_row.last_heartbeat_at, week_start_ts)))::integer));

    UPDATE public.study_room_members
    SET today_seconds = CASE
          WHEN today_date = credit_day THEN today_seconds + elapsed_today
          WHEN today_date IS NULL OR today_date < credit_day THEN elapsed_today
          ELSE today_seconds
        END,
        today_date = CASE
          WHEN today_date IS NULL OR today_date < credit_day THEN credit_day
          ELSE today_date
        END,
        week_seconds = CASE
          WHEN week_start = monday THEN week_seconds + elapsed_week
          WHEN week_start IS NULL OR week_start < monday THEN elapsed_week
          ELSE week_seconds
        END,
        week_start = CASE
          WHEN week_start IS NULL OR week_start < monday THEN monday
          ELSE week_start
        END,
        session_elapsed_seconds = CASE WHEN credit_day = current_day
          THEN coalesce(session_elapsed_seconds, 0) + elapsed_total ELSE 0 END,
        session_date = credit_day,
        is_studying = false,
        session_active = (credit_day = current_day),
        session_started_at = NULL,
        last_heartbeat_at = NULL,
        updated_at = credit_until
    WHERE user_id = member_row.user_id;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.study_room_pause_stale_sessions(uuid) FROM PUBLIC, anon, authenticated;

DO $schedule$
DECLARE existing_job bigint;
BEGIN
  FOR existing_job IN
    SELECT jobid FROM cron.job
    WHERE jobname IN ('study-room-expire-idle-sessions', 'study-room-pause-stale-sessions')
  LOOP
    PERFORM cron.unschedule(existing_job);
  END LOOP;
  PERFORM cron.schedule(
    'study-room-pause-stale-sessions',
    '* * * * *',
    'SELECT public.study_room_pause_stale_sessions();'
  );
END;
$schedule$;

CREATE OR REPLACE VIEW public.study_room_live
WITH (security_invoker = true) AS
WITH member_state AS (
  SELECT m.*,
    timezone('Asia/Colombo', now())::date AS local_day,
    (m.is_studying AND (
      m.last_heartbeat_at IS NULL
      OR m.last_heartbeat_at <= now() - interval '12 hours'
    )) AS idle_stale,
    (m.session_active AND NOT m.is_studying
      AND m.session_date IS DISTINCT FROM timezone('Asia/Colombo', now())::date
    ) AS paused_session_expired,
    (m.is_studying
      AND m.session_date IS DISTINCT FROM timezone('Asia/Colombo', now())::date
    ) AS session_day_changed
  FROM public.study_room_members AS m
)
SELECT
  m.user_id,
  study_room_private.display_name_for_member(m.user_id) AS display_name,
  m.subject,
  CASE WHEN m.idle_stale THEN false ELSE m.is_studying END AS is_studying,
  CASE WHEN m.idle_stale OR m.paused_session_expired THEN NULL::timestamptz ELSE m.session_started_at END AS session_started_at,
  CASE WHEN m.idle_stale OR m.paused_session_expired THEN NULL::timestamptz ELSE m.last_heartbeat_at END AS last_heartbeat_at,
  m.today_seconds,
  m.today_date,
  m.week_seconds,
  m.week_start,
  m.updated_at,
  study_room_private.gender_for_member(m.user_id) AS gender,
  CASE WHEN m.today_date = m.local_day
       THEN m.today_time ELSE '00:00:00'::text END AS today_time,
  CASE WHEN m.week_start = public.study_room_local_week_start(m.local_day)
       THEN m.week_time ELSE '00:00:00'::text END AS week_time,
  CASE WHEN m.idle_stale OR m.paused_session_expired OR m.session_day_changed
       THEN 0 ELSE m.session_elapsed_seconds END AS session_elapsed_seconds,
  CASE WHEN m.idle_stale OR m.paused_session_expired OR m.session_day_changed
       THEN m.local_day ELSE m.session_date END AS session_date,
  CASE WHEN m.idle_stale OR m.paused_session_expired
       THEN false ELSE m.session_active END AS session_active
FROM member_state AS m
WHERE study_room_private.profile_is_complete(m.user_id);

REVOKE ALL ON public.study_room_live FROM public, anon, authenticated;
GRANT SELECT ON public.study_room_live TO authenticated;

DO $paused_session_schedule$
DECLARE
  existing_job bigint;
BEGIN
  FOR existing_job IN
    SELECT jobid FROM cron.job WHERE jobname = 'study-room-expire-paused-sessions'
  LOOP
    PERFORM cron.unschedule(existing_job);
  END LOOP;

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
          updated_at = now()
      WHERE is_studying = false
        AND session_active = true
        AND session_date IS DISTINCT FROM timezone('Asia/Colombo', now())::date;
    $job$
  );
END;
$paused_session_schedule$;
