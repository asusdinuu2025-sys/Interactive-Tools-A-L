-- DESTRUCTIVE: apply only after the browser-local dashboard code has been deployed.
-- Existing cloud progress/favorite rows will be permanently deleted.
-- Do not apply before the new frontend is live, because the old production frontend
-- still writes to these tables. Each browser can migrate its own saved rows only
-- while the legacy tables exist.
DROP TABLE IF EXISTS public.studylab_progress;
DROP TABLE IF EXISTS public.studylab_favorites;