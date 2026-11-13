-- Keep browser-local subject analytics aligned with the server's credited Study Room time.
-- Settle the running interval under the previous subject before changing the subject label.
CREATE OR REPLACE FUNCTION public.study_room_set_subject(p_subject text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
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

  -- The heartbeat uses the same server-side presence/credit path as the live timer.
  -- It is a no-op for paused sessions and commits the old subject's interval first.
  PERFORM public.study_room_heartbeat();

  UPDATE public.study_room_members
  SET subject = p_subject, updated_at = now()
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Create a profile first';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.study_room_set_subject(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.study_room_set_subject(text) TO authenticated;

-- Make explicit pause idempotent and tolerant of legacy rows where is_studying
-- is true but session_active was not migrated correctly.
CREATE OR REPLACE FUNCTION public.study_room_pause()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  reference_now timestamptz := now();
  member_row public.study_room_members%rowtype;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sign-in required';
  END IF;

  -- First apply the normal presence transition, which settles present/away time.
  PERFORM public.study_room_presence(true);

  SELECT * INTO member_row
  FROM public.study_room_members
  WHERE user_id = uid
  FOR UPDATE;

  IF NOT FOUND OR NOT (member_row.session_active OR member_row.is_studying) THEN
    RETURN;
  END IF;

  -- Fallback for an inconsistent legacy row: settle any remaining present interval.
  -- Normally presence(true) has already moved last_heartbeat_at to reference_now.
  IF member_row.is_studying
    AND member_row.session_presence_state = 'present'
    AND member_row.last_heartbeat_at IS NOT NULL
    AND member_row.last_heartbeat_at < reference_now THEN
    PERFORM study_room_private.credit_session_interval(
      uid, member_row.last_heartbeat_at, reference_now, false
    );
  END IF;

  UPDATE public.study_room_members
  SET
    is_studying = false,
    session_active = true,
    session_presence_state = 'paused',
    session_started_at = NULL,
    session_away_since_at = NULL,
    session_away_pending_seconds = 0,
    session_away_pending_date = timezone('Asia/Colombo', reference_now)::date,
    session_away_pending_week_start = public.study_room_local_week_start(
      timezone('Asia/Colombo', reference_now)::date
    ),
    last_heartbeat_at = NULL,
    updated_at = reference_now
  WHERE user_id = uid
    AND (session_active = true OR is_studying = true);
END;
$function$;

REVOKE ALL ON FUNCTION public.study_room_pause() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.study_room_pause() TO authenticated;
