-- Add optional profile icon data and show it through the hardened live-room view.
-- Existing rows remain valid until students complete/update their profile.
ALTER TABLE public.studylab_profiles
  ADD COLUMN IF NOT EXISTS gender text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'studylab_profiles_gender_check'
      AND conrelid = 'public.studylab_profiles'::regclass
  ) THEN
    ALTER TABLE public.studylab_profiles
      ADD CONSTRAINT studylab_profiles_gender_check
      CHECK (gender IS NULL OR gender IN ('male', 'female'));
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION study_room_private.gender_for_member(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p.gender
  FROM public.studylab_profiles p
  WHERE p.id = p_user_id
    AND EXISTS (
      SELECT 1
      FROM public.study_room_members m
      WHERE m.user_id = p_user_id
    );
$function$;

REVOKE ALL ON FUNCTION study_room_private.gender_for_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION study_room_private.gender_for_member(uuid) TO authenticated;

CREATE OR REPLACE VIEW public.study_room_live
WITH (security_invoker = true) AS
SELECT
  m.user_id,
  study_room_private.display_name_for_member(m.user_id) AS display_name,
  study_room_private.gender_for_member(m.user_id) AS gender,
  m.subject,
  m.is_studying,
  m.session_started_at,
  m.last_heartbeat_at,
  m.today_seconds,
  m.today_date,
  m.week_seconds,
  m.week_start,
  m.updated_at
FROM public.study_room_members m;

REVOKE ALL ON public.study_room_live FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.study_room_live TO authenticated;

-- Chat history is retained indefinitely except for the oldest rows beyond 100.
-- A new 101st message removes exactly the oldest message; 102 removes the next oldest.
CREATE OR REPLACE FUNCTION public.cleanup_studylab_chat()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  DELETE FROM public.studylab_chat_messages
  WHERE id IN (
    SELECT id
    FROM public.studylab_chat_messages
    ORDER BY created_at DESC, id DESC
    OFFSET 100
  );
END;
$function$;
