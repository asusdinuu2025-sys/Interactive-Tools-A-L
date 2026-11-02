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
        OR last_heartbeat_at <= reference_now - interval '5 minutes'
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

    -- Allow normal background-tab throttling while still pausing abandoned sessions.
    credit_until := LEAST(
      reference_now,
      member_row.last_heartbeat_at + interval '5 minutes',
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
        updated_at = credit_until
    WHERE user_id = member_row.user_id;
  END LOOP;
END;
$function$;

CREATE OR REPLACE VIEW public.study_room_live
WITH (security_invoker = true) AS
WITH member_state AS (
  SELECT m.*,
    (m.is_studying AND (
      m.last_heartbeat_at IS NULL
      OR m.last_heartbeat_at <= now() - interval '5 minutes'
    )) AS idle_stale
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
  CASE WHEN m.today_date = timezone('Asia/Colombo', now())::date
       THEN m.today_time ELSE '00:00:00'::text END AS today_time,
  CASE WHEN m.week_start = public.study_room_local_week_start(timezone('Asia/Colombo', now())::date)
       THEN m.week_time ELSE '00:00:00'::text END AS week_time,
  m.session_elapsed_seconds,
  m.session_date,
  CASE WHEN m.idle_stale THEN true ELSE m.session_active END AS session_active
FROM member_state AS m
WHERE study_room_private.profile_is_complete(m.user_id);

REVOKE ALL ON public.study_room_live FROM public, anon, authenticated;
GRANT SELECT ON public.study_room_live TO authenticated;
