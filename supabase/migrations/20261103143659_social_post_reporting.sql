CREATE TABLE public.studylab_social_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.studylab_social_posts(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN (
    'spam',
    'harassment',
    'inappropriate_content',
    'misinformation',
    'other'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studylab_social_reports_one_per_student_per_post
    UNIQUE (post_id, reporter_id)
);

ALTER TABLE public.studylab_social_reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.studylab_social_reports FROM anon, authenticated;
GRANT INSERT ON TABLE public.studylab_social_reports TO authenticated;

CREATE POLICY "Students can report approved posts once"
ON public.studylab_social_reports
FOR INSERT
TO authenticated
WITH CHECK (
  reporter_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.studylab_social_posts AS post
    WHERE post.id = post_id
      AND post.status = 'approved'
      AND post.author_id <> (SELECT auth.uid())
  )
);
