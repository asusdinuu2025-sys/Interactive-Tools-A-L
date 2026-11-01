-- Allow the existing "Other" dropdown option in the Study Room subject RPC.
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
