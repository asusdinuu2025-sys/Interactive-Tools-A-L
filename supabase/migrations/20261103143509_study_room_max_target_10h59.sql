-- Limit all newly started Study Room sessions to 10 hours 59 minutes.
-- The table-level 12-hour ceiling is intentionally retained so existing
-- compatibility sessions created before this release remain valid.

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
  IF p_target_seconds IS NULL OR p_target_seconds < 60 OR p_target_seconds > 39540 THEN
    RAISE EXCEPTION 'Choose a target between 1 minute and 10 hours 59 minutes.';
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

-- Keep the legacy no-argument overload within the same new maximum.
CREATE OR REPLACE FUNCTION public.study_room_start()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  PERFORM public.study_room_start(39540);
END;
$function$;
