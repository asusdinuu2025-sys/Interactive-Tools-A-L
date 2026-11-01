-- Authoritative, background-safe Study Room sessions with explicit pause/resume/end.
ALTER TABLE public.study_room_members ADD COLUMN IF NOT EXISTS session_active boolean NOT NULL DEFAULT false;
UPDATE public.study_room_members SET session_active = (is_studying OR session_elapsed_seconds > 0) WHERE NOT session_active;
CREATE OR REPLACE VIEW public.study_room_live WITH (security_invoker = true) AS
SELECT m.user_id, study_room_private.display_name_for_member(m.user_id) AS display_name,
 m.subject, m.is_studying, m.session_started_at, m.last_heartbeat_at, m.today_seconds,
 m.today_date, m.week_seconds, m.week_start, m.updated_at,
 study_room_private.gender_for_member(m.user_id) AS gender,
 CASE WHEN m.today_date = timezone('Asia/Colombo', now())::date THEN m.today_time ELSE '00:00:00'::text END AS today_time,
 CASE WHEN m.week_start = public.study_room_local_week_start(timezone('Asia/Colombo', now())::date) THEN m.week_time ELSE '00:00:00'::text END AS week_time,
 m.session_elapsed_seconds, m.session_date, m.session_active
FROM public.study_room_members m
WHERE study_room_private.profile_is_complete(m.user_id);
REVOKE ALL ON public.study_room_live FROM public, anon, authenticated;
GRANT SELECT ON public.study_room_live TO authenticated;
CREATE OR REPLACE FUNCTION public.study_room_heartbeat()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE uid uuid:=auth.uid(); local_day date:=timezone('Asia/Colombo',now())::date;
 monday date:=public.study_room_local_week_start(timezone('Asia/Colombo',now())::date);
 day_start timestamptz:=(timezone('Asia/Colombo',now())::date::timestamp AT TIME ZONE 'Asia/Colombo');
 week_start_ts timestamptz; elapsed_total integer; elapsed_today integer; elapsed_week integer;
 previous public.study_room_members%rowtype;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
 IF NOT study_room_private.profile_is_complete(uid) THEN
  UPDATE public.study_room_members SET is_studying=false,session_active=false,session_started_at=NULL,session_elapsed_seconds=0,last_heartbeat_at=NULL,updated_at=now() WHERE user_id=uid; RETURN;
 END IF;
 week_start_ts:=(monday::timestamp AT TIME ZONE 'Asia/Colombo');
 SELECT * INTO previous FROM public.study_room_members WHERE user_id=uid FOR UPDATE;
 IF NOT FOUND OR NOT previous.is_studying THEN RETURN; END IF;
 IF previous.last_heartbeat_at IS NULL THEN UPDATE public.study_room_members SET last_heartbeat_at=now(),updated_at=now() WHERE user_id=uid; RETURN; END IF;
 elapsed_total:=greatest(0,floor(extract(epoch FROM (now()-previous.last_heartbeat_at)))::integer);
 elapsed_today:=greatest(0,floor(extract(epoch FROM (now()-greatest(previous.last_heartbeat_at,day_start)))::integer));
 elapsed_week:=greatest(0,floor(extract(epoch FROM (now()-greatest(previous.last_heartbeat_at,week_start_ts)))::integer));
 UPDATE public.study_room_members SET
  today_seconds=CASE WHEN today_date=local_day THEN today_seconds+elapsed_today ELSE elapsed_today END,
  today_date=local_day,
  week_seconds=CASE WHEN week_start=monday THEN week_seconds+elapsed_week ELSE elapsed_week END,
  week_start=monday,
  session_elapsed_seconds=CASE WHEN session_date=local_day THEN session_elapsed_seconds+elapsed_total ELSE elapsed_total END,
  session_date=local_day,last_heartbeat_at=now(),updated_at=now()
 WHERE user_id=uid;
END;
$function$;
CREATE OR REPLACE FUNCTION public.study_room_start()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE uid uuid:=auth.uid(); local_day date:=timezone('Asia/Colombo',now())::date; current_member public.study_room_members%rowtype;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
 IF NOT study_room_private.profile_is_complete(uid) THEN RAISE EXCEPTION 'Complete your StudyLab profile before entering the Live Study Room.'; END IF;
 SELECT * INTO current_member FROM public.study_room_members WHERE user_id=uid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Create a profile first'; END IF;
 IF current_member.is_studying THEN PERFORM public.study_room_heartbeat(); RETURN; END IF;
 UPDATE public.study_room_members SET is_studying=true,session_active=true,
  session_elapsed_seconds=CASE WHEN current_member.session_active AND current_member.session_date=local_day THEN current_member.session_elapsed_seconds ELSE 0 END,
  session_date=local_day,session_started_at=now(),last_heartbeat_at=now(),updated_at=now() WHERE user_id=uid;
END;
$function$;
CREATE OR REPLACE FUNCTION public.study_room_pause()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE uid uuid:=auth.uid();
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
 PERFORM public.study_room_heartbeat();
 UPDATE public.study_room_members SET is_studying=false,session_active=true,session_started_at=NULL,last_heartbeat_at=NULL,updated_at=now()
 WHERE user_id=uid AND session_active=true;
END;
$function$;
CREATE OR REPLACE FUNCTION public.study_room_end()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE uid uuid:=auth.uid(); local_day date:=timezone('Asia/Colombo',now())::date;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
 PERFORM public.study_room_heartbeat();
 UPDATE public.study_room_members SET is_studying=false,session_active=false,session_started_at=NULL,session_elapsed_seconds=0,session_date=local_day,last_heartbeat_at=NULL,updated_at=now()
 WHERE user_id=uid;
END;
$function$;
CREATE OR REPLACE FUNCTION public.study_room_leave()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
 PERFORM public.study_room_end();
END;
$function$;
REVOKE ALL ON FUNCTION public.study_room_start() FROM public,anon;
REVOKE ALL ON FUNCTION public.study_room_heartbeat() FROM public,anon;
REVOKE ALL ON FUNCTION public.study_room_pause() FROM public,anon;
REVOKE ALL ON FUNCTION public.study_room_end() FROM public,anon;
REVOKE ALL ON FUNCTION public.study_room_leave() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.study_room_start() TO authenticated;
GRANT EXECUTE ON FUNCTION public.study_room_heartbeat() TO authenticated;
GRANT EXECUTE ON FUNCTION public.study_room_pause() TO authenticated;
GRANT EXECUTE ON FUNCTION public.study_room_end() TO authenticated;
GRANT EXECUTE ON FUNCTION public.study_room_leave() TO authenticated;
