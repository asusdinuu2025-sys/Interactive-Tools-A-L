-- Restrict internal StudyLab chat/feedback trigger functions to trigger execution only.
-- PostgreSQL triggers can still invoke these functions after EXECUTE is revoked
-- from API roles; SECURITY DEFINER owners retain their own privileges.
REVOKE EXECUTE ON FUNCTION public.cleanup_studylab_chat() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_studylab_chat_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_studylab_feedback_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trim_studylab_chat_after_insert() FROM PUBLIC, anon, authenticated;

-- This helper only performs date arithmetic; an empty search_path avoids
-- resolving unexpected objects from schemas supplied by callers.
ALTER FUNCTION public.study_room_local_week_start(date) SET search_path = '';
