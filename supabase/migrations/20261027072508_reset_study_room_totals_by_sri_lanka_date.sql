CREATE OR REPLACE FUNCTION public.study_room_ensure_profile()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  local_day date := timezone('Asia/Colombo', now())::date;
  monday date := public.study_room_local_week_start(timezone('Asia/Colombo', now())::date);
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
  IF NOT study_room_private.profile_is_complete(uid) THEN
    RAISE EXCEPTION 'Complete your StudyLab profile before entering the Live Study Room.';
  END IF;
  UPDATE public.study_room_members
  SET today_seconds = CASE WHEN today_date = local_day THEN today_seconds ELSE 0 END,
      today_date = local_day,
      week_seconds = CASE WHEN week_start = monday THEN week_seconds ELSE 0 END,
      week_start = monday,
      updated_at = now()
  WHERE today_date <> local_day OR week_start <> monday;
  INSERT INTO public.study_room_members(user_id) VALUES (uid)
  ON CONFLICT (user_id) DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.study_room_heartbeat()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  local_day date := timezone('Asia/Colombo', now())::date;
  monday date := public.study_room_local_week_start(timezone('Asia/Colombo', now())::date);
  elapsed integer;
  previous public.study_room_members%rowtype;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
  UPDATE public.study_room_members
  SET today_seconds = CASE WHEN today_date = local_day THEN today_seconds ELSE 0 END,
      today_date = local_day,
      week_seconds = CASE WHEN week_start = monday THEN week_seconds ELSE 0 END,
      week_start = monday,
      updated_at = now()
  WHERE today_date <> local_day OR week_start <> monday;
  SELECT * INTO previous FROM public.study_room_members
    WHERE user_id = uid AND is_studying FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  elapsed := greatest(0, least(90,
    floor(extract(epoch from (now() - previous.last_heartbeat_at)))::int));
  UPDATE public.study_room_members
  SET today_seconds = (CASE WHEN today_date = local_day THEN today_seconds ELSE 0 END) + elapsed,
      today_date = local_day,
      week_seconds = (CASE WHEN week_start = monday THEN week_seconds ELSE 0 END) + elapsed,
      week_start = monday,
      last_heartbeat_at = now(),
      updated_at = now()
  WHERE user_id = uid;
END;
$function$;

CREATE OR REPLACE VIEW public.study_room_live
WITH (security_invoker = true) AS
SELECT
  m.user_id,
  study_room_private.display_name_for_member(m.user_id) AS display_name,
  m.subject, m.is_studying, m.session_started_at, m.last_heartbeat_at,
  m.today_seconds, m.today_date, m.week_seconds, m.week_start, m.updated_at,
  study_room_private.gender_for_member(m.user_id) AS gender,
  CASE WHEN m.today_date = timezone('Asia/Colombo', now())::date
       THEN m.today_time ELSE '00:00:00' END AS today_time,
  CASE WHEN m.week_start = public.study_room_local_week_start(timezone('Asia/Colombo', now())::date)
       THEN m.week_time ELSE '00:00:00' END AS week_time
FROM public.study_room_members m;

REVOKE ALL ON public.study_room_live FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.study_room_live TO authenticated;