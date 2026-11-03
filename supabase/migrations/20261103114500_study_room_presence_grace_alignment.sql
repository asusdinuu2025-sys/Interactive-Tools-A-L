-- Align the server-side lost-heartbeat detector with a 20-second heartbeat
-- plus the agreed 60-second visibility grace period.
CREATE OR REPLACE FUNCTION public.study_room_process_away_sessions(
  p_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  reference_now timestamptz := now();
  local_day date := timezone('Asia/Colombo', now())::date;
  member_row public.study_room_members%rowtype;
  away_at timestamptz;
  credit_until timestamptz;
  remaining_seconds integer;
  target_seconds integer;
BEGIN
  FOR member_row IN
    SELECT *
    FROM public.study_room_members
    WHERE is_studying = true
      AND (p_user_id IS NULL OR user_id = p_user_id)
      AND session_presence_state = 'present'
      AND (
        last_heartbeat_at IS NULL
        OR last_heartbeat_at <= reference_now - interval '80 seconds'
      )
    FOR UPDATE SKIP LOCKED
  LOOP
    away_at := CASE
      WHEN member_row.last_heartbeat_at IS NULL THEN reference_now
      ELSE member_row.last_heartbeat_at + interval '80 seconds'
    END;

    IF member_row.last_heartbeat_at IS NOT NULL AND away_at > member_row.last_heartbeat_at THEN
      PERFORM study_room_private.credit_session_interval(
        member_row.user_id, member_row.last_heartbeat_at, least(away_at, reference_now), false
      );
    END IF;

    UPDATE public.study_room_members
    SET
      session_presence_state = 'away',
      session_away_since_at = away_at,
      last_heartbeat_at = away_at,
      updated_at = away_at
    WHERE user_id = member_row.user_id
      AND is_studying = true;

    SELECT * INTO member_row
    FROM public.study_room_members
    WHERE user_id = member_row.user_id;

    target_seconds := coalesce(member_row.session_target_seconds, 43200);
    remaining_seconds := greatest(0, target_seconds - coalesce(member_row.session_elapsed_seconds, 0));
    credit_until := least(reference_now, member_row.last_heartbeat_at + make_interval(secs => remaining_seconds));

    IF credit_until > member_row.last_heartbeat_at THEN
      PERFORM study_room_private.credit_session_interval(
        member_row.user_id, member_row.last_heartbeat_at, credit_until, true
      );
    END IF;

    SELECT * INTO member_row
    FROM public.study_room_members
    WHERE user_id = member_row.user_id;

    IF coalesce(member_row.session_elapsed_seconds, 0) >= target_seconds THEN
      UPDATE public.study_room_members
      SET
        is_studying = false,
        session_active = true,
        session_presence_state = 'auto_paused',
        session_started_at = NULL,
        session_target_reached_at = coalesce(member_row.last_heartbeat_at, reference_now),
        session_away_since_at = NULL,
        last_heartbeat_at = NULL,
        updated_at = coalesce(member_row.last_heartbeat_at, reference_now)
      WHERE user_id = member_row.user_id;
    END IF;
  END LOOP;

  FOR member_row IN
    SELECT *
    FROM public.study_room_members
    WHERE is_studying = true
      AND session_presence_state = 'away'
      AND (p_user_id IS NULL OR user_id = p_user_id)
    FOR UPDATE SKIP LOCKED
  LOOP
    target_seconds := coalesce(member_row.session_target_seconds, 43200);
    remaining_seconds := greatest(0, target_seconds - coalesce(member_row.session_elapsed_seconds, 0));
    credit_until := least(
      reference_now,
      coalesce(member_row.last_heartbeat_at, member_row.session_away_since_at, reference_now)
        + make_interval(secs => remaining_seconds)
    );

    IF member_row.last_heartbeat_at IS NOT NULL AND credit_until > member_row.last_heartbeat_at THEN
      PERFORM study_room_private.credit_session_interval(
        member_row.user_id, member_row.last_heartbeat_at, credit_until, true
      );
    END IF;

    SELECT * INTO member_row
    FROM public.study_room_members
    WHERE user_id = member_row.user_id;

    IF coalesce(member_row.session_elapsed_seconds, 0) >= target_seconds THEN
      UPDATE public.study_room_members
      SET
        is_studying = false,
        session_active = true,
        session_presence_state = 'auto_paused',
        session_started_at = NULL,
        session_target_reached_at = coalesce(member_row.last_heartbeat_at, reference_now),
        session_away_since_at = NULL,
        last_heartbeat_at = NULL,
        updated_at = coalesce(member_row.last_heartbeat_at, reference_now)
      WHERE user_id = member_row.user_id;
    END IF;
  END LOOP;

  FOR member_row IN
    SELECT *
    FROM public.study_room_members
    WHERE session_active = true
      AND session_presence_state = 'auto_paused'
      AND session_target_reached_at IS NOT NULL
      AND timezone('Asia/Colombo', session_target_reached_at)::date < local_day
      AND (p_user_id IS NULL OR user_id = p_user_id)
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM study_room_private.expire_member_session(member_row.user_id, reference_now);
  END LOOP;

  FOR member_row IN
    SELECT *
    FROM public.study_room_members
    WHERE session_active = true
      AND is_studying = false
      AND session_presence_state = 'paused'
      AND session_date IS DISTINCT FROM local_day
      AND (p_user_id IS NULL OR user_id = p_user_id)
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM study_room_private.expire_member_session(member_row.user_id, reference_now);
  END LOOP;
END;
$function$;

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
      m.session_active
      AND m.session_presence_state IN ('paused', 'auto_paused')
      AND m.session_date IS DISTINCT FROM c.local_day
    ) AS paused_session_expired,
    (
      m.is_studying
      AND m.session_presence_state = 'present'
      AND (
        m.last_heartbeat_at IS NULL
        OR m.last_heartbeat_at <= now() - interval '80 seconds'
      )
    ) AS presence_stale
  FROM public.study_room_members AS m
  CROSS JOIN clock AS c
)
SELECT
  m.user_id,
  study_room_private.display_name_for_member(m.user_id) AS display_name,
  m.subject,
  (m.is_studying AND m.session_presence_state = 'present' AND NOT m.presence_stale) AS is_studying,
  CASE WHEN m.paused_session_expired THEN NULL::timestamptz ELSE m.session_started_at END AS session_started_at,
  CASE WHEN m.paused_session_expired THEN NULL::timestamptz ELSE m.last_heartbeat_at END AS last_heartbeat_at,
  CASE WHEN m.today_date = m.local_day THEN m.today_seconds ELSE 0 END AS today_seconds,
  m.today_date,
  CASE WHEN m.week_start = m.local_week THEN m.week_seconds ELSE 0 END AS week_seconds,
  m.week_start,
  m.updated_at,
  study_room_private.gender_for_member(m.user_id) AS gender,
  CASE
    WHEN m.today_date = m.local_day THEN
      lpad((m.today_seconds / 3600)::text, 2, '0') || ':' ||
      lpad(((m.today_seconds % 3600) / 60)::text, 2, '0') || ':' ||
      lpad((m.today_seconds % 60)::text, 2, '0')
    ELSE '00:00:00'::text
  END AS today_time,
  CASE
    WHEN m.week_start = m.local_week THEN
      lpad((m.week_seconds / 3600)::text, 2, '0') || ':' ||
      lpad(((m.week_seconds % 3600) / 60)::text, 2, '0') || ':' ||
      lpad((m.week_seconds % 60)::text, 2, '0')
    ELSE '00:00:00'::text
  END AS week_time,
  CASE WHEN m.paused_session_expired THEN 0 ELSE coalesce(m.session_elapsed_seconds, 0) END AS session_elapsed_seconds,
  CASE WHEN m.paused_session_expired THEN m.local_day ELSE m.session_date END AS session_date,
  (m.session_active AND NOT m.paused_session_expired) AS session_active,
  m.session_expired_at,
  CASE WHEN m.presence_stale THEN 'away' ELSE m.session_presence_state END AS session_presence_state,
  m.session_target_seconds,
  m.session_target_reached_at,
  CASE
    WHEN m.presence_stale THEN coalesce(m.session_away_since_at, m.last_heartbeat_at + interval '80 seconds')
    ELSE m.session_away_since_at
  END AS session_away_since_at,
  m.session_away_pending_seconds
FROM member_state AS m
WHERE study_room_private.profile_is_complete(m.user_id);

REVOKE ALL ON public.study_room_live FROM public, anon, authenticated;
GRANT SELECT ON public.study_room_live TO authenticated;
