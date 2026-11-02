DROP POLICY IF EXISTS "StudyLab chat read recent authenticated messages"
  ON public.studylab_chat_messages;
DROP POLICY IF EXISTS "StudyLab chat read latest 100 messages"
  ON public.studylab_chat_messages;
CREATE POLICY "StudyLab chat read latest 100 messages"
  ON public.studylab_chat_messages
  FOR SELECT TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.cleanup_studylab_chat()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  DELETE FROM public.studylab_chat_messages
  WHERE id IN (
    SELECT id FROM public.studylab_chat_messages
    ORDER BY created_at DESC, id DESC
    OFFSET 100
  );
END;
$function$;