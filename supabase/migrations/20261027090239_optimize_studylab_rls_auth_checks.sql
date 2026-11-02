-- Recovered from the applied Supabase migration ledger on 2026-11-02.
-- Original SQL statements are preserved from supabase_migrations.schema_migrations.

ALTER POLICY "StudyLab profile read own" ON public.studylab_profiles
  USING (id = (select auth.uid()));
ALTER POLICY "StudyLab profile insert own" ON public.studylab_profiles
  WITH CHECK (id = (select auth.uid()));
ALTER POLICY "StudyLab profile update own" ON public.studylab_profiles
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));
ALTER POLICY "StudyLab chat insert own authenticated messages" ON public.studylab_chat_messages
  WITH CHECK (
    user_id = (select auth.uid())
    AND char_length(btrim(message)) BETWEEN 1 AND 500
    AND char_length(btrim(nickname)) BETWEEN 1 AND 60
    AND created_at >= now() - interval '30 seconds'
    AND created_at <= now() + interval '5 minutes'
  );
ALTER POLICY "StudyLab feedback insert own" ON public.studylab_feedback
  WITH CHECK (
    user_id = (select auth.uid())
    AND char_length(btrim(message)) BETWEEN 2 AND 1200
    AND category IN ('bug', 'suggestion', 'resource')
  );
