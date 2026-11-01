-- Also make the subject allow-list/table constraint and definer function safe on databases where the earlier migration version was already recorded.
-- Allow the existing Other dropdown option while preserving profile requirements and safe function resolution.
ALTER TABLE public.study_room_members
  DROP CONSTRAINT IF EXISTS study_room_members_subject_check;
ALTER TABLE public.study_room_members
  ADD CONSTRAINT study_room_members_subject_check
  CHECK (subject IN (
    'Combined Mathematics', 'Physics', 'Chemistry', 'Biology',
    'Agricultural Science', 'Information & Communication Technology (ICT)',
    'General English', 'General Common Test', 'Accounting', 'Business Studies',
    'Economics', 'Business Statistics', 'Logic and Scientific Method',
    'Geography', 'Political Science', 'History', 'Home Economics',
    'Communication and Media Studies', 'Buddhism', 'Christianity', 'Hinduism',
    'Islam', 'Buddhist Civilization', 'Christian Civilization',
    'Hindu Civilization', 'Islamic Civilization', 'Sinhala', 'Tamil',
    'English', 'Pali', 'Sanskrit', 'Arabic', 'French', 'German', 'Japanese',
    'Korean', 'Chinese', 'Russian', 'Art', 'Oriental Music', 'Western Music',
    'Carnatic Music', 'Dancing (Oriental)', 'Dancing (Bharatha)',
    'Drama and Theatre', 'Engineering Technology', 'Science for Technology',
    'Bio Systems Technology', 'Agro Technology', 'Food Technology',
    'Mechanical Technology',
    'Electrical, Electronic and Information Technology', 'Civil Technology',
    'Design, Electrical and Electronic Technology',
    'Design and Construction Technology', 'Design and Mechanical Technology',
    'Design, Quantity Surveying and Construction Process', 'Other'
  ));

CREATE OR REPLACE FUNCTION public.study_room_set_subject(p_subject text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign-in required';
  END IF;

  IF NOT study_room_private.profile_is_complete(auth.uid()) THEN
    RAISE EXCEPTION 'Complete your StudyLab profile before entering the Live Study Room.';
  END IF;

  IF p_subject IS NULL OR p_subject NOT IN (
    'Combined Mathematics', 'Physics', 'Chemistry', 'Biology',
    'Agricultural Science', 'Information & Communication Technology (ICT)',
    'General English', 'General Common Test', 'Accounting', 'Business Studies',
    'Economics', 'Business Statistics', 'Logic and Scientific Method',
    'Geography', 'Political Science', 'History', 'Home Economics',
    'Communication and Media Studies', 'Buddhism', 'Christianity', 'Hinduism',
    'Islam', 'Buddhist Civilization', 'Christian Civilization',
    'Hindu Civilization', 'Islamic Civilization', 'Sinhala', 'Tamil',
    'English', 'Pali', 'Sanskrit', 'Arabic', 'French', 'German', 'Japanese',
    'Korean', 'Chinese', 'Russian', 'Art', 'Oriental Music', 'Western Music',
    'Carnatic Music', 'Dancing (Oriental)', 'Dancing (Bharatha)',
    'Drama and Theatre', 'Engineering Technology', 'Science for Technology',
    'Bio Systems Technology', 'Agro Technology', 'Food Technology',
    'Mechanical Technology',
    'Electrical, Electronic and Information Technology', 'Civil Technology',
    'Design, Electrical and Electronic Technology',
    'Design and Construction Technology', 'Design and Mechanical Technology',
    'Design, Quantity Surveying and Construction Process', 'Other'
  ) THEN
    RAISE EXCEPTION 'Invalid subject';
  END IF;

  UPDATE public.study_room_members
  SET subject = p_subject, updated_at = now()
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Create a profile first';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.study_room_set_subject(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.study_room_set_subject(text) TO authenticated;

-- Expire an abandoned running Study Room session after 24 hours without a heartbeat.
-- A successful heartbeat refreshes last_heartbeat_at and starts a fresh 24-hour window.

CREATE OR REPLACE VIEW public.study_room_live WITH (security_invoker = true) AS
WITH member_state AS (
  SELECT m.*,
    (m.is_studying AND (m.last_heartbeat_at IS NULL OR m.last_heartbeat_at <= now() - interval '24 hours')) AS idle_expired
  FROM public.study_room_members AS m
)
SELECT
  m.user_id,
  study_room_private.display_name_for_member(m.user_id) AS display_name,
  m.subject,
  CASE WHEN m.idle_expired THEN false ELSE m.is_studying END AS is_studying,
  CASE WHEN m.idle_expired THEN NULL::timestamptz ELSE m.session_started_at END AS session_started_at,
  CASE WHEN m.idle_expired THEN NULL::timestamptz ELSE m.last_heartbeat_at END AS last_heartbeat_at,
  CASE WHEN m.idle_expired THEN 0 ELSE m.today_seconds END AS today_seconds,
  CASE WHEN m.idle_expired THEN timezone('Asia/Colombo', now())::date ELSE m.today_date END AS today_date,
  CASE WHEN m.idle_expired THEN 0 ELSE m.week_seconds END AS week_seconds,
  CASE WHEN m.idle_expired THEN public.study_room_local_week_start(timezone('Asia/Colombo', now())::date) ELSE m.week_start END AS week_start,
  m.updated_at,
  study_room_private.gender_for_member(m.user_id) AS gender,
  CASE WHEN m.idle_expired THEN '00:00:00'::text
       WHEN m.today_date = timezone('Asia/Colombo', now())::date THEN m.today_time
       ELSE '00:00:00'::text END AS today_time,
  CASE WHEN m.idle_expired THEN '00:00:00'::text
       WHEN m.week_start = public.study_room_local_week_start(timezone('Asia/Colombo', now())::date) THEN m.week_time
       ELSE '00:00:00'::text END AS week_time,
  CASE WHEN m.idle_expired THEN 0 ELSE m.session_elapsed_seconds END AS session_elapsed_seconds,
  CASE WHEN m.idle_expired THEN timezone('Asia/Colombo', now())::date ELSE m.session_date END AS session_date,
  CASE WHEN m.idle_expired THEN false ELSE m.session_active END AS session_active
FROM member_state AS m
WHERE study_room_private.profile_is_complete(m.user_id);

REVOKE ALL ON public.study_room_live FROM public, anon, authenticated;
GRANT SELECT ON public.study_room_live TO authenticated;

CREATE OR REPLACE FUNCTION public.study_room_heartbeat()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  local_day date := timezone('Asia/Colombo', now())::date;
  monday date := public.study_room_local_week_start(timezone('Asia/Colombo', now())::date);
  day_start timestamptz := (timezone('Asia/Colombo', now())::date::timestamp AT TIME ZONE 'Asia/Colombo');
  week_start_ts timestamptz;
  elapsed_total integer;
  elapsed_today integer;
  elapsed_week integer;
  previous public.study_room_members%rowtype;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
  IF NOT study_room_private.profile_is_complete(uid) THEN
    UPDATE public.study_room_members
    SET is_studying = false, session_active = false, session_started_at = NULL,
        session_elapsed_seconds = 0, last_heartbeat_at = NULL, updated_at = now()
    WHERE user_id = uid;
    RETURN;
  END IF;

  -- Expire all abandoned running sessions so their attendance and rank totals
  -- clear even when the student whose session expired does not return.
  UPDATE public.study_room_members
  SET is_studying = false, session_active = false, session_started_at = NULL,
      last_heartbeat_at = NULL, session_elapsed_seconds = 0,
      session_date = local_day, today_seconds = 0, today_date = local_day,
      week_seconds = 0, week_start = monday, updated_at = now()
  WHERE is_studying = true
    AND (last_heartbeat_at IS NULL OR last_heartbeat_at <= now() - interval '24 hours');

  week_start_ts := (monday::timestamp AT TIME ZONE 'Asia/Colombo');
  SELECT * INTO previous
  FROM public.study_room_members
  WHERE user_id = uid
  FOR UPDATE;

  IF NOT FOUND OR NOT previous.is_studying THEN RETURN; END IF;
  IF previous.last_heartbeat_at IS NULL THEN
    UPDATE public.study_room_members SET last_heartbeat_at = now(), updated_at = now()
    WHERE user_id = uid;
    RETURN;
  END IF;

  elapsed_total := greatest(0, floor(extract(epoch FROM (now() - previous.last_heartbeat_at)))::integer);
  elapsed_today := greatest(0, floor(extract(epoch FROM (now() - greatest(previous.last_heartbeat_at, day_start)))::integer));
  elapsed_week := greatest(0, floor(extract(epoch FROM (now() - greatest(previous.last_heartbeat_at, week_start_ts)))::integer);

  UPDATE public.study_room_members
  SET today_seconds = CASE WHEN today_date = local_day THEN today_seconds + elapsed_today ELSE elapsed_today END,
      today_date = local_day,
      week_seconds = CASE WHEN week_start = monday THEN week_seconds + elapsed_week ELSE elapsed_week END,
      week_start = monday,
      session_elapsed_seconds = CASE WHEN session_date = local_day THEN session_elapsed_seconds + elapsed_total ELSE elapsed_total END,
      session_date = local_day, last_heartbeat_at = now(), updated_at = now()
  WHERE user_id = uid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.study_room_start()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  local_day date := timezone('Asia/Colombo', now())::date;
  current_member public.study_room_members%rowtype;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
  IF NOT study_room_private.profile_is_complete(uid) THEN
    RAISE EXCEPTION 'Complete your StudyLab profile before entering the Live Study Room.';
  END IF;

  -- Apply expiry before deciding whether this is a duplicate Start or a new session.
  PERFORM public.study_room_heartbeat();

  SELECT * INTO current_member
  FROM public.study_room_members
  WHERE user_id = uid
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Create a profile first'; END IF;
  IF current_member.is_studying THEN RETURN; END IF;

  UPDATE public.study_room_members
  SET is_studying = true,
      session_active = true,
      session_elapsed_seconds = CASE
        WHEN current_member.session_active AND current_member.session_date = local_day
          THEN current_member.session_elapsed_seconds
        ELSE 0
      END,
      session_date = local_day, session_started_at = now(),
      last_heartbeat_at = now(), updated_at = now()
  WHERE user_id = uid;
END;
$function$;

REVOKE ALL ON FUNCTION public.study_room_heartbeat() FROM public, anon;
REVOKE ALL ON FUNCTION public.study_room_start() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.study_room_heartbeat() TO authenticated;
GRANT EXECUTE ON FUNCTION public.study_room_start() TO authenticated;
