-- Accept the exact end of the 60-second visibility grace period from the client.
-- This avoids treating time beyond the grace as present when hidden-tab timers throttle.
CREATE OR REPLACE FUNCTION public.study_room_presence_at(
  p_is_present boolean,
  p_transition_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  reference_now timestamptz := now();
  local_day date := timezone('Asia/Colombo', now())::date;
  transition_at timestamptz;
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

  -- For an explicit away transition, honour the browser's exact grace-expiry time.
  -- Do not run the coarse lost-heartbeat fallback before this timestamp is applied.
  SELECT * INTO member_row
  FROM public.study_room_members
  WHERE user_id = uid
  FOR UPDATE;

  IF NOT FOUND OR NOT member_row.is_studying
    OR member_row.session_presence_state <> 'present' THEN
    RETURN;
  END IF;

  transition_at := least(coalesce(p_transition_at, reference_now), reference_now);
  IF member_row.last_heartbeat_at IS NOT NULL THEN
    transition_at := greatest(transition_at, member_row.last_heartbeat_at);
    IF transition_at > member_row.last_heartbeat_at THEN
      PERFORM study_room_private.credit_session_interval(
        uid, member_row.last_heartbeat_at, transition_at, false
      );
    END IF;
  END IF;

  UPDATE public.study_room_members
  SET
    session_presence_state = 'away',
    session_away_since_at = transition_at,
    last_heartbeat_at = transition_at,
    updated_at = transition_at
  WHERE user_id = uid
    AND is_studying = true
    AND session_presence_state = 'present';

  -- Credit the away interval from the grace-expiry point to now, capped at target.
  PERFORM public.study_room_process_away_sessions(uid);
END;
$function$;

CREATE OR REPLACE FUNCTION public.study_room_presence(p_is_present boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  PERFORM public.study_room_presence_at(p_is_present, now());
END;
$function$;

REVOKE ALL ON FUNCTION public.study_room_presence_at(boolean, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.study_room_presence_at(boolean, timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION public.study_room_presence(boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.study_room_presence(boolean) TO authenticated;
