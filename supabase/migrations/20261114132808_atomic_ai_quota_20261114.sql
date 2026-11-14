-- Atomic StudyLab AI quotas. Anonymous Google/Guest accounts can invoke the
-- RPC only for their own authenticated Supabase identity.
CREATE TABLE IF NOT EXISTS public.studylab_ai_weekly_quota (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_start)
);
CREATE TABLE IF NOT EXISTS public.studylab_ai_ip_minute_quota (
  ip_hash text NOT NULL,
  minute_bucket bigint NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ip_hash, minute_bucket)
);
ALTER TABLE public.studylab_ai_weekly_quota ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studylab_ai_ip_minute_quota ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.studylab_ai_weekly_quota FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.studylab_ai_ip_minute_quota FROM anon, authenticated, PUBLIC;

CREATE OR REPLACE FUNCTION public.studylab_ai_atomic_reserve(p_ip_hash text)
RETURNS TABLE(allowed boolean, remaining integer, reason text, retry_after integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  uid uuid := auth.uid();
  local_day date := timezone('Asia/Colombo', now())::date;
  monday date := public.study_room_local_week_start(local_day);
  minute_id bigint := floor(extract(epoch from now()) / 60)::bigint;
  weekly_used integer;
  minute_used integer;
  limit_week integer := 56;
  limit_minute integer := 5;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
  IF p_ip_hash IS NULL OR p_ip_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid request identifier';
  END IF;

  INSERT INTO public.studylab_ai_weekly_quota AS q
    (user_id, week_start, request_count)
    VALUES (uid, monday, 1)
  ON CONFLICT (user_id, week_start)
    DO UPDATE SET request_count = q.request_count + 1, updated_at = now()
    WHERE q.request_count < limit_week
  RETURNING request_count INTO weekly_used;

  IF weekly_used IS NULL THEN
    RETURN QUERY SELECT false, 0, 'weekly_limit'::text, 0;
    RETURN;
  END IF;

  INSERT INTO public.studylab_ai_ip_minute_quota AS q
    (ip_hash, minute_bucket, request_count)
    VALUES (p_ip_hash, minute_id, 1)
  ON CONFLICT (ip_hash, minute_bucket)
    DO UPDATE SET request_count = q.request_count + 1, updated_at = now()
    WHERE q.request_count < limit_minute
  RETURNING request_count INTO minute_used;

  IF minute_used IS NULL THEN
    -- Reverse the first reservation atomically inside this transaction.
    UPDATE public.studylab_ai_weekly_quota
       SET request_count = greatest(request_count - 1, 0), updated_at = now()
     WHERE user_id = uid AND week_start = monday;
    RETURN QUERY
      SELECT false, greatest(limit_week - weekly_used + 1, 0),
             'ip_limit'::text,
             greatest(1, 60 - (extract(epoch from now())::integer % 60));
    RETURN;
  END IF;

  RETURN QUERY SELECT true, greatest(0, limit_week - weekly_used), ''::text, 0;
END;
$$;

REVOKE ALL ON FUNCTION public.studylab_ai_atomic_reserve(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.studylab_ai_atomic_reserve(text) TO authenticated;

-- Keep the per-minute counter table small without requiring any read grants.
SELECT cron.schedule(
  'studylab-ai-rate-window-cleanup',
  '23 3 * * *',
  $cleanup$DELETE FROM public.studylab_ai_ip_minute_quota
           WHERE minute_bucket < floor(extract(epoch from now()) / 60)::bigint - 1440$cleanup$
);
