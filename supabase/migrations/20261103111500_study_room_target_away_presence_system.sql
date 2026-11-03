-- Study Room target-based away handling and Sri Lanka-local daily credit.
-- Existing session totals are preserved. Existing open sessions receive a one-time
-- 12-hour compatibility target; all newly started sessions require an explicit target.
ALTER TABLE public.study_room_members
  ADD COLUMN IF NOT EXISTS session_target_seconds integer,
  ADD COLUMN IF NOT EXISTS session_presence_state text NOT NULL DEFAULT 'paused',
  ADD COLUMN IF NOT EXISTS session_away_since_at timestamptz,
  ADD COLUMN IF NOT EXISTS session_away_pending_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS session_away_pending_date date NOT NULL DEFAULT (timezone('Asia/Colombo', now()))::date,
  ADD COLUMN IF NOT EXISTS session_away_pending_week_start date NOT NULL DEFAULT
    ((timezone('Asia/Colombo', now()))::date -
      (extract(isodow FROM timezone('Asia/Colombo', now()))::integer - 1)),
  ADD COLUMN IF NOT EXISTS session_target_reached_at timestamptz;

ALTER TABLE public.study_room_members
  DROP CONSTRAINT IF EXISTS study_room_members_session_target_seconds_check,
  ADD CONSTRAINT study_room_members_session_target_seconds_check
    CHECK (session_target_seconds IS NULL OR session_target_seconds BETWEEN 60 AND 43200),
  DROP CONSTRAINT IF EXISTS study_room_members_session_presence_state_check,
  ADD CONSTRAINT study_room_members_session_presence_state_check
    CHECK (session_presence_state IN ('present', 'away', 'paused', 'auto_paused')),
  DROP CONSTRAINT IF EXISTS study_room_members_session_away_pending_seconds_check,
  ADD CONSTRAINT study_room_members_session_away_pending_seconds_check
    CHECK (session_away_pending_seconds >= 0);

-- Keep sessions already in progress intact during rollout. New sessions never receive
-- an implicit target; the frontend must supply one.
UPDATE public.study_room_members
SET session_target_seconds = COALESCE(session_target_seconds, 43200),
    session_presence_state = CASE
      WHEN is_studying THEN 'present'
      WHEN session_active THEN 'paused'
      ELSE 'paused'
    END
WHERE is_studying OR session_active;

CREATE OR REPLACE FUNCTION study_room_private.split_credit_seconds(
  p_from timestamptz,
  p_until timestamptz
)
RETURNS TABLE(local_day date, seconds integer, local_week date)
LANGUAGE sql
STABLE
SET search_path = ''
AS $function$
  WITH days AS (
    SELECT generate_series(
      timezone('Asia/Colombo', p_from)::date,
      timezone('Asia/Colombo', p_until)::date,
      interval '1 day'
    )::date AS day_key
  ),
  portions AS (
    SELECT
      day_key,
      greatest(
        0,
        floor(extract(epoch FROM (
          least(p_until, ((day_key + 1)::timestamp AT TIME ZONE 'Asia/Colombo'))
          - greatest(p_from, (day_key::timestamp AT TIME ZONE 'Asia/Colombo'))
        )))::integer
      ) AS credited_seconds
    FROM days
    WHERE p_until > p_from
  )
  SELECT
    day_key,
    credited_seconds,
    public.study_room_local_week_start(day_key)
  FROM portions
  WHERE credited_seconds > 0;
$function$;

CREATE OR REPLACE FUNCTION study_room_private.credit_session_interval(
  p_user_id uuid,
  p_from timestamptz,
  p_until timestamptz,
  p_is_away boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  current_row public.study_room_members%rowtype;
  local_day date := timezone('Asia/Colombo', p_until)::date;
  monday date := public.study_room_local_week_start(timezone('Asia/Colombo', p_until)::date);
  elapsed_total integer;
  elapsed_today integer;
  elapsed_week integer;
BEGIN
  IF p_until IS NULL OR p_from IS NULL OR p_until <= p_from THEN
    RETURN;
  END IF;

  SELECT * INTO current_row
  FROM public.study_room_members
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT
    coalesce(sum(parts.seconds), 0)::integer,
    coalesce(sum(parts.seconds) FILTER (WHERE parts.local_day = local_day), 0)::integer,
    coalesce(sum(parts.seconds) FILTER (WHERE parts.local_week = monday), 0)::integer
  INTO elapsed_total, elapsed_today, elapsed_week
  FROM study_room_private.split_credit_seconds(p_from, p_until) AS parts;

  UPDATE public.study_room_members
  SET
    today_seconds = CASE
      WHEN today_date = local_day THEN coalesce(today_seconds, 0) + elapsed_today
      ELSE elapsed_today
    END,
    today_date = local_day,
    week_seconds = CASE
      WHEN week_start = monday THEN coalesce(week_seconds, 0) + elapsed_week
      ELSE elapsed_week
    END,
    week_start = monday,
    session_elapsed_seconds = coalesce(current_row.session_elapsed_seconds, 0) + elapsed_total,
    session_date = local_day,
    session_today_seconds = CASE
      WHEN current_row.session_today_date = local_day
        THEN coalesce(current_row.session_today_seconds, 0) + elapsed_today
      ELSE elapsed_today
    END,
    session_today_date = local_day,
    session_week_seconds = CASE
      WHEN current_row.session_week_start = monday
        THEN coalesce(current_row.session_week_seconds, 0) + elapsed_week
      ELSE elapsed_week
    END,
    session_week_start = monday,
    session_away_pending_seconds = CASE
      WHEN p_is_away THEN
        CASE
          WHEN current_row.session_away_pending_date = local_day
            THEN coalesce(current_row.session_away_pending_seconds, 0) + elapsed_today
          ELSE elapsed_today
        END
      ELSE coalesce(current_row.session_away_pending_seconds, 0)
    END,
    session_away_pending_date = CASE
      WHEN p_is_away THEN local_day
      ELSE current_row.session_away_pending_date
    END,
    session_away_pending_week_start = CASE
      WHEN p_is_away THEN monday
      ELSE current_row.session_away_pending_week_start
    END,
    last_heartbeat_at = p_until,
    updated_at = p_until
  WHERE user_id = p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION study_room_private.expire_member_session(
  p_user_id uuid,
  p_expired_at timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  current_row public.study_room_members%rowtype;
  local_day date := timezone('Asia/Colombo', p_expired_at)::date;
  monday date := public.study_room_local_week_start(timezone('Asia/Colombo', p_expired_at)::date);
  pending integer;
BEGIN
  SELECT * INTO current_row
  FROM public.study_room_members
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;
  pending := greatest(0, coalesce(current_row.session_away_pending_seconds, 0));

  UPDATE public.study_room_members
  SET
    today_seconds = CASE
      WHEN current_row.today_date = current_row.session_away_pending_date
        THEN greatest(0, coalesce(current_row.today_seconds, 0) - pending)
      WHEN current_row.today_date = local_day
        THEN coalesce(current_row.today_seconds, 0)
      ELSE 0
    END,
    today_date = local_day,
    week_seconds = CASE
      WHEN current_row.week_start = current_row.session_away_pending_week_start
        THEN greatest(0, coalesce(current_row.week_seconds, 0) - pending)
      ELSE coalesce(current_row.week_seconds, 0)
    END,
    session_week_seconds = CASE
      WHEN current_row.session_week_start = current_row.session_away_pending_week_start
        THEN greatest(0, coalesce(current_row.session_week_seconds, 0) - pending)
      ELSE coalesce(current_row.session_week_seconds, 0)
    END,
    is_studying = false,
    session_active = false,
    session_presence_state = 'paused',
    session_target_seconds = NULL,
    session_target_reached_at = NULL,
    session_away_since_at = NULL,
    session_away_pending_seconds = 0,
    session_away_pending_date = local_day,
    session_away_pending_week_start = monday,
    session_started_at = NULL,
    last_heartbeat_at = NULL,
    session_elapsed_seconds = 0,
    session_date = local_day,
    session_today_seconds = 0,
    session_today_date = local_day,
    session_week_seconds = 0,
    session_week_start = monday,
    session_expired_at = p_expired_at,
    updated_at = p_expired_at
  WHERE user_id = p_user_id;
END;
$function$;

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
  -- A missed heartbeat is treated as an away transition after the agreed 60-second
  -- grace period. The grace interval itself remains credited as present time.
  FOR member_row IN
    SELECT *
    FROM public.study_room_members
    WHERE is_studying = true
      AND (p_user_id IS NULL OR user_id = p_user_id)
      AND session_presence_state = 'present'
      AND (
        last_heartbeat_at IS NULL
        OR last_heartbeat_at <= reference_now - interval '60 seconds'
      )
    FOR UPDATE SKIP LOCKED
  LOOP
    away_at := CASE
      WHEN member_row.last_heartbeat_at IS NULL THEN reference_now
      ELSE member_row.last_heartbeat_at + interval '60 seconds'
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

  -- Continue processing sessions already marked away. Their elapsed time is capped
  -- at the selected target; present sessions are deliberately never target-capped.
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

  -- An away session that reached its target remains resumable for the rest of that
  -- Sri Lanka day. If the student never returns before midnight, discard only the
  -- unconfirmed away credit from that target day; earlier days remain untouched.
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

  -- Manually paused sessions are already confirmed. They simply become a fresh
  -- session on the next local day, without changing daily or weekly earned totals.
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

CREATE OR REPLACE FUNCTION public.study_room_pause_stale_sessions(
  p_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  PERFORM public.study_room_process_away_sessions(p_user_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.study_room_presence(p_is_present boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  reference_now timestamptz := now();
  local_day date := timezone('Asia/Colombo', now())::date;
  member_row public.study_room_members%rowtype;
  target_seconds integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
  IF p_is_present IS NULL THEN RAISE EXCEPTION 'Presence state is required'; END IF;

  IF p_is_present THEN
    PERFORM public.study_room_process_away_sessions(uid);

    SELECT * INTO member_row
    FROM public.study_room_members
    WHERE user_id = uid
    FOR UPDATE;

    IF NOT FOUND OR NOT member_row.session_active THEN RETURN; END IF;

    IF member_row.session_presence_state = 'auto_paused' THEN
      IF member_row.session_target_reached_at IS NOT NULL
        AND timezone('Asia/Colombo', member_row.session_target_reached_at)::date < local_day THEN
        PERFORM study_room_private.expire_member_session(uid, reference_now);
        RETURN;
      END IF;

      -- Returning before midnight confirms the pending away time, even if the
      -- student chooses not to resume the timer immediately.
      UPDATE public.study_room_members
      SET
        session_presence_state = 'paused',
        session_away_pending_seconds = 0,
        session_away_pending_date = local_day,
        session_away_pending_week_start = public.study_room_local_week_start(local_day),
        session_away_since_at = NULL,
        last_heartbeat_at = NULL,
        updated_at = reference_now
      WHERE user_id = uid;
      RETURN;
    END IF;

    IF member_row.is_studying AND member_row.session_presence_state = 'away' THEN
      target_seconds := coalesce(member_row.session_target_seconds, 43200);
      IF coalesce(member_row.session_elapsed_seconds, 0) >= target_seconds THEN
        UPDATE public.study_room_members
        SET
          is_studying = false,
          session_active = true,
          session_presence_state = 'paused',
          session_target_reached_at = coalesce(session_target_reached_at, last_heartbeat_at, reference_now),
          session_started_at = NULL,
          session_away_pending_seconds = 0,
          session_away_pending_date = local_day,
          session_away_pending_week_start = public.study_room_local_week_start(local_day),
          session_away_since_at = NULL,
          last_heartbeat_at = NULL,
          updated_at = reference_now
        WHERE user_id = uid;
        RETURN;
      END IF;

      UPDATE public.study_room_members
      SET
        session_presence_state = 'present',
        session_away_since_at = NULL,
        session_away_pending_seconds = 0,
        session_away_pending_date = local_day,
        session_away_pending_week_start = public.study_room_local_week_start(local_day),
        last_heartbeat_at = reference_now,
        updated_at = reference_now
      WHERE user_id = uid;
      RETURN;
    END IF;

    IF member_row.is_studying AND member_row.session_presence_state = 'present' THEN
      IF member_row.last_heartbeat_at IS NOT NULL THEN
        PERFORM study_room_private.credit_session_interval(
          uid, member_row.last_heartbeat_at, reference_now, false
        );
      END IF;
      UPDATE public.study_room_members
      SET last_heartbeat_at = reference_now, updated_at = reference_now
      WHERE user_id = uid AND is_studying = true;
    END IF;
    RETURN;
  END IF;

  -- Explicit away transition (tab close or a full 60-second hidden/blurred period).
  PERFORM public.study_room_process_away_sessions(uid);

  SELECT * INTO member_row
  FROM public.study_room_members
  WHERE user_id = uid
  FOR UPDATE;

  IF NOT FOUND OR NOT member_row.is_studying
    OR member_row.session_presence_state <> 'present' THEN
    RETURN;
  END IF;

  IF member_row.last_heartbeat_at IS NOT NULL THEN
    PERFORM study_room_private.credit_session_interval(
      uid, member_row.last_heartbeat_at, reference_now, false
    );
  END IF;

  SELECT * INTO member_row
  FROM public.study_room_members
  WHERE user_id = uid;

  target_seconds := coalesce(member_row.session_target_seconds, 43200);

  IF coalesce(member_row.session_elapsed_seconds, 0) >= target_seconds THEN
    UPDATE public.study_room_members
    SET
      is_studying = false,
      session_active = true,
      session_presence_state = 'auto_paused',
      session_started_at = NULL,
      session_target_reached_at = reference_now,
      session_away_since_at = NULL,
      last_heartbeat_at = NULL,
      updated_at = reference_now
    WHERE user_id = uid;
  ELSE
    UPDATE public.study_room_members
    SET
      session_presence_state = 'away',
      session_away_since_at = reference_now,
      last_heartbeat_at = reference_now,
      updated_at = reference_now
    WHERE user_id = uid;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.study_room_heartbeat()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  PERFORM public.study_room_presence(true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.study_room_start(p_target_seconds integer)
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
  IF p_target_seconds IS NULL OR p_target_seconds < 60 OR p_target_seconds > 43200 THEN
    RAISE EXCEPTION 'Choose a target between 1 minute and 12 hours.';
  END IF;
  IF NOT study_room_private.profile_is_complete(uid) THEN
    RAISE EXCEPTION 'Complete your StudyLab profile before entering the Live Study Room.';
  END IF;

  PERFORM public.study_room_presence(true);
  PERFORM public.study_room_process_away_sessions(uid);

  SELECT * INTO current_member
  FROM public.study_room_members
  WHERE user_id = uid
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Create a profile first'; END IF;
  IF current_member.is_studying AND current_member.session_presence_state = 'present' THEN
    RETURN;
  END IF;

  IF current_member.session_active
    AND current_member.session_date = local_day
    AND current_member.session_presence_state IN ('paused', 'auto_paused') THEN
    UPDATE public.study_room_members
    SET
      is_studying = true,
      session_active = true,
      session_presence_state = 'present',
      session_target_seconds = coalesce(current_member.session_target_seconds, p_target_seconds),
      session_started_at = now(),
      last_heartbeat_at = now(),
      session_away_since_at = NULL,
      session_away_pending_seconds = 0,
      session_away_pending_date = local_day,
      session_away_pending_week_start = monday,
      session_expired_at = NULL,
      updated_at = now()
    WHERE user_id = uid;
    RETURN;
  END IF;

  UPDATE public.study_room_members
  SET
    is_studying = true,
    session_active = true,
    session_presence_state = 'present',
    session_target_seconds = p_target_seconds,
    session_target_reached_at = NULL,
    session_started_at = now(),
    last_heartbeat_at = now(),
    session_elapsed_seconds = 0,
    session_date = local_day,
    session_today_seconds = 0,
    session_today_date = local_day,
    session_week_seconds = 0,
    session_week_start = monday,
    session_away_since_at = NULL,
    session_away_pending_seconds = 0,
    session_away_pending_date = local_day,
    session_away_pending_week_start = monday,
    session_expired_at = NULL,
    updated_at = now()
  WHERE user_id = uid;
END;
$function$;

-- Compatibility wrapper for already-open clients during the staged frontend rollout.
-- The new frontend always calls the integer-argument function with the selected target.
CREATE OR REPLACE FUNCTION public.study_room_start()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  PERFORM public.study_room_start(43200);
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
  PERFORM public.study_room_presence(true);

  UPDATE public.study_room_members
  SET
    is_studying = false,
    session_active = true,
    session_presence_state = 'paused',
    session_started_at = NULL,
    session_away_since_at = NULL,
    session_away_pending_seconds = 0,
    session_away_pending_date = timezone('Asia/Colombo', now())::date,
    session_away_pending_week_start = public.study_room_local_week_start(timezone('Asia/Colombo', now())::date),
    last_heartbeat_at = NULL,
    updated_at = now()
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
  PERFORM public.study_room_presence(true);

  UPDATE public.study_room_members
  SET
    is_studying = false,
    session_active = false,
    session_presence_state = 'paused',
    session_target_seconds = NULL,
    session_target_reached_at = NULL,
    session_started_at = NULL,
    session_away_since_at = NULL,
    session_away_pending_seconds = 0,
    session_away_pending_date = local_day,
    session_away_pending_week_start = monday,
    last_heartbeat_at = NULL,
    session_elapsed_seconds = 0,
    session_date = local_day,
    session_today_seconds = 0,
    session_today_date = local_day,
    session_week_seconds = 0,
    session_week_start = monday,
    session_expired_at = NULL,
    updated_at = now()
  WHERE user_id = uid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.study_room_run_maintenance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  PERFORM public.study_room_process_away_sessions();
END;
$function$;

-- Replace the old 12-hour watchdog and midnight cleanup with the target-aware processor.
DO $schedule$
DECLARE
  existing_job bigint;
BEGIN
  FOR existing_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN (
      'study-room-pause-stale-sessions',
      'study-room-expire-paused-sessions',
      'study-room-process-away-sessions'
    )
  LOOP
    PERFORM cron.unschedule(existing_job);
  END LOOP;

  PERFORM cron.schedule(
    'study-room-process-away-sessions',
    '* * * * *',
    'SELECT public.study_room_process_away_sessions();'
  );
END;
$schedule$;

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
        OR m.last_heartbeat_at <= now() - interval '60 seconds'
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
  CASE
    WHEN m.presence_stale THEN 'away'
    ELSE m.session_presence_state
  END AS session_presence_state,
  m.session_target_seconds,
  m.session_target_reached_at,
  CASE
    WHEN m.presence_stale THEN coalesce(m.session_away_since_at, m.last_heartbeat_at + interval '60 seconds')
    ELSE m.session_away_since_at
  END AS session_away_since_at,
  m.session_away_pending_seconds
FROM member_state AS m
WHERE study_room_private.profile_is_complete(m.user_id);

REVOKE ALL ON public.study_room_live FROM public, anon, authenticated;
GRANT SELECT ON public.study_room_live TO authenticated;

REVOKE ALL ON FUNCTION study_room_private.split_credit_seconds(timestamptz, timestamptz) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION study_room_private.credit_session_interval(uuid, timestamptz, timestamptz, boolean) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION study_room_private.expire_member_session(uuid, timestamptz) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.study_room_process_away_sessions(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.study_room_pause_stale_sessions(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.study_room_presence(boolean) FROM public, anon;
REVOKE ALL ON FUNCTION public.study_room_heartbeat() FROM public, anon;
REVOKE ALL ON FUNCTION public.study_room_start(integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.study_room_start() FROM public, anon;
REVOKE ALL ON FUNCTION public.study_room_pause() FROM public, anon;
REVOKE ALL ON FUNCTION public.study_room_end() FROM public, anon;
REVOKE ALL ON FUNCTION public.study_room_run_maintenance() FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.study_room_presence(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.study_room_heartbeat() TO authenticated;
GRANT EXECUTE ON FUNCTION public.study_room_start(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.study_room_start() TO authenticated;
GRANT EXECUTE ON FUNCTION public.study_room_pause() TO authenticated;
GRANT EXECUTE ON FUNCTION public.study_room_end() TO authenticated;
