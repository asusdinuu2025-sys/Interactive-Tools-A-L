-- Route Social Network posts and comments through AI moderation before publication.
-- The Edge Function performs Gemini screening and only then changes pending -> approved.
ALTER TABLE public.studylab_social_posts
  DROP CONSTRAINT IF EXISTS studylab_social_posts_status_check;
ALTER TABLE public.studylab_social_posts
  ADD CONSTRAINT studylab_social_posts_status_check
  CHECK (status = ANY (ARRAY['uploading'::text, 'pending'::text, 'approved'::text, 'rejected'::text, 'removed'::text]));

ALTER TABLE public.studylab_social_comments
  DROP CONSTRAINT IF EXISTS studylab_social_comments_status_check;
ALTER TABLE public.studylab_social_comments
  ADD CONSTRAINT studylab_social_comments_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'removed'::text]));

-- The insert trigger changes a comment to pending before policy checks run.
DROP POLICY IF EXISTS "Students add published comments to approved posts"
  ON public.studylab_social_comments;
CREATE POLICY "Students submit pending comments to approved posts"
  ON public.studylab_social_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND status = 'pending'
  );

-- Comments are stored privately as pending until the moderation Edge Function approves them.
CREATE OR REPLACE FUNCTION public.studylab_social_prepare_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  profile_row public.studylab_profiles%rowtype;
BEGIN
  IF auth.uid() IS NULL OR new.author_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO profile_row
  FROM public.studylab_profiles
  WHERE id = auth.uid();

  IF NOT FOUND
     OR profile_row.display_name IS NULL
     OR profile_row.display_name ~ '^Student[0-9]{4}$'
     OR profile_row.username IS NULL
     OR profile_row.exam_year IS NULL
     OR profile_row.study_stream IS NULL THEN
    RAISE EXCEPTION 'Complete your basic StudyLab profile before commenting';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.studylab_social_posts
    WHERE id = new.post_id AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Comments are available on published posts only';
  END IF;

  new.author_display_name := profile_row.display_name;
  new.author_username := profile_row.username;
  new.author_gender := profile_row.gender;
  new.body := btrim(coalesce(new.body, ''));
  new.status := 'pending';
  new.created_at := now();
  RETURN new;
END;
$function$;

-- Completing image uploads only moves a post into the private moderation queue.
-- It no longer publishes the post directly.
CREATE OR REPLACE FUNCTION public.studylab_social_publish_own_post(p_post_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.studylab_social_posts
  SET status = 'pending'
  WHERE id = p_post_id
    AND author_id = auth.uid()
    AND status = 'uploading';

  RETURN FOUND;
END;
$function$;

