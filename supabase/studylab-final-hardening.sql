-- StudyLab final security hardening.
-- The current profile editor uses the authenticated check_* RPCs.
-- These older availability RPCs are not intended to be callable anonymously.
-- Keep authenticated execution for compatibility with already-cached clients.
REVOKE EXECUTE ON FUNCTION public.studylab_display_name_available(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.studylab_display_name_available(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.studylab_username_available(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.studylab_username_available(text) TO authenticated;
