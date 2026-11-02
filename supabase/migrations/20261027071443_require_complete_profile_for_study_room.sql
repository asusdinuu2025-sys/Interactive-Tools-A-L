CREATE OR REPLACE FUNCTION study_room_private.profile_is_complete(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.studylab_profiles p
    WHERE p.id = p_user_id AND p.profile_completed_at IS NOT NULL
      AND length(btrim(p.display_name)) >= 2
      AND p.display_name !~ '^Student[0-9]{4}$'
      AND p.exam_year IS NOT NULL AND p.study_stream IS NOT NULL
      AND p.gender IN ('male', 'female')
  );
$function$;
REVOKE ALL ON FUNCTION study_room_private.profile_is_complete(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION study_room_private.profile_is_complete(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.study_room_ensure_profile()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
  IF NOT study_room_private.profile_is_complete(uid) THEN
    RAISE EXCEPTION 'Complete your StudyLab profile before entering the Live Study Room.';
  END IF;
  INSERT INTO public.study_room_members(user_id) VALUES (uid)
  ON CONFLICT (user_id) DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.study_room_set_subject(p_subject text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
  IF NOT study_room_private.profile_is_complete(auth.uid()) THEN
    RAISE EXCEPTION 'Complete your StudyLab profile before entering the Live Study Room.';
  END IF;
  IF p_subject NOT IN (
    'Combined Mathematics','Physics','Chemistry','Biology','Agricultural Science',
    'Information & Communication Technology (ICT)','General English','General Common Test',
    'Accounting','Business Studies','Economics','Business Statistics','Logic and Scientific Method',
    'Geography','Political Science','History','Home Economics','Communication and Media Studies',
    'Buddhism','Christianity','Hinduism','Islam','Buddhist Civilization','Christian Civilization',
    'Hindu Civilization','Islamic Civilization','Sinhala','Tamil','English','Pali','Sanskrit','Arabic',
    'French','German','Japanese','Korean','Chinese','Russian','Art','Oriental Music','Western Music',
    'Carnatic Music','Dancing (Oriental)','Dancing (Bharatha)','Drama and Theatre',
    'Engineering Technology','Science for Technology','Bio Systems Technology','Agro Technology',
    'Food Technology','Mechanical Technology','Electrical, Electronic and Information Technology',
    'Civil Technology','Design, Electrical and Electronic Technology','Design and Construction Technology',
    'Design and Mechanical Technology','Design, Quantity Surveying and Construction Process'
  ) THEN RAISE EXCEPTION 'Invalid subject'; END IF;
  UPDATE public.study_room_members SET subject = p_subject, updated_at = now()
  WHERE user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Create a profile first'; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.study_room_start()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
  IF NOT study_room_private.profile_is_complete(auth.uid()) THEN
    RAISE EXCEPTION 'Complete your StudyLab profile before entering the Live Study Room.';
  END IF;
  UPDATE public.study_room_members
    SET is_studying = true, session_started_at = now(),
        last_heartbeat_at = now(), updated_at = now()
    WHERE user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Create a profile first'; END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.study_room_ensure_profile() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.study_room_set_subject(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.study_room_start() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.study_room_ensure_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.study_room_set_subject(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.study_room_start() TO authenticated;