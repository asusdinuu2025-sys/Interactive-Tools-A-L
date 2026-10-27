-- Record the Study Room view hardening already tested on the live project.
CREATE SCHEMA IF NOT EXISTS study_room_private;
REVOKE ALL ON SCHEMA study_room_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA study_room_private TO authenticated;

CREATE OR REPLACE FUNCTION study_room_private.display_name_for_member(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE(
    (SELECT NULLIF(p.display_name, '')
     FROM public.studylab_profiles p
     WHERE p.id = p_user_id),
    'Student'
  )
  WHERE EXISTS (
    SELECT 1
    FROM public.study_room_members m
    WHERE m.user_id = p_user_id
  );
$function$;

REVOKE ALL ON FUNCTION study_room_private.display_name_for_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION study_room_private.display_name_for_member(uuid) TO authenticated;

CREATE OR REPLACE VIEW public.study_room_live
WITH (security_invoker = true) AS
SELECT m.user_id,
       study_room_private.display_name_for_member(m.user_id) AS display_name,
       m.subject, m.is_studying, m.session_started_at, m.last_heartbeat_at,
       m.today_seconds, m.today_date, m.week_seconds, m.week_start, m.updated_at
FROM public.study_room_members m;

REVOKE ALL ON public.study_room_live FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.study_room_live TO authenticated;
