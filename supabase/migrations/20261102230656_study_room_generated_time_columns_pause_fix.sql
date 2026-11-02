-- Keep Study Room heartbeat compatible with GENERATED ALWAYS formatted-time columns.
-- today_time and week_time are derived from today_seconds/week_seconds and must not be assigned.
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
  elapsed_week := greatest(0, floor(extract(epoch FROM (reference_now - greatest(previous.last_heartbeat_at, week_start_ts)))::integer));

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
    week_seconds = next_week,
    week_start = monday,
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
