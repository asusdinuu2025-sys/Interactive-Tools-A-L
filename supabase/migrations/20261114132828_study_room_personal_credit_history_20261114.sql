-- Server-authoritative Study Room credit journal.
-- Additive migration; keeps existing member totals and timer behavior intact.
-- Historical browser-only subject data predating this migration stays locally
-- available, since assigning it to cloud subjects without proof would fabricate data.
ALTER TABLE public.study_room_members
  ADD COLUMN IF NOT EXISTS session_id uuid;

-- Older in-progress sessions receive an identity; new sessions receive one in
-- the BEFORE UPDATE trigger without rewriting the established timer RPCs.
UPDATE public.study_room_members
SET session_id = gen_random_uuid()
WHERE session_active = true AND session_id IS NULL;

CREATE OR REPLACE FUNCTION study_room_private.study_room_assign_session_id()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF NEW.session_active AND (NOT COALESCE(OLD.session_active, false) OR NEW.session_id IS NULL) THEN
    NEW.session_id := gen_random_uuid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS study_room_assign_session_id ON public.study_room_members;
CREATE TRIGGER study_room_assign_session_id BEFORE UPDATE ON public.study_room_members
FOR EACH ROW EXECUTE FUNCTION study_room_private.study_room_assign_session_id();

CREATE TABLE IF NOT EXISTS public.study_room_credit_segments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  local_day date NOT NULL,
  subject text NOT NULL,
  credited_from timestamptz NOT NULL,
  credited_until timestamptz NOT NULL,
  seconds integer NOT NULL CHECK (seconds > 0),
  pending boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Preserve today's existing server total before the journal begins. The
-- historic subject mix is unavailable to the server, so name it explicitly.
INSERT INTO public.study_room_credit_segments
  (user_id, session_id, local_day, subject, credited_from, credited_until, seconds, pending)
SELECT m.user_id, coalesce(m.session_id, m.user_id), m.today_date,
  'Before cloud sync (subject unavailable)',
  greatest((m.today_date::timestamp at time zone 'Asia/Colombo'), now() - make_interval(secs => greatest(0, m.today_seconds))),
  now(),
  greatest(0, m.today_seconds - CASE WHEN m.session_away_pending_date = m.today_date THEN coalesce(m.session_away_pending_seconds, 0) ELSE 0 END),
  false
FROM public.study_room_members AS m
WHERE m.today_date = timezone('Asia/Colombo', now())::date
  AND greatest(0, m.today_seconds - CASE WHEN m.session_away_pending_date = m.today_date THEN coalesce(m.session_away_pending_seconds, 0) ELSE 0 END) > 0;

CREATE INDEX IF NOT EXISTS study_room_credit_user_day_idx
  ON public.study_room_credit_segments (user_id, local_day DESC);
CREATE INDEX IF NOT EXISTS study_room_credit_user_session_idx
  ON public.study_room_credit_segments (user_id, session_id, pending);

ALTER TABLE public.study_room_credit_segments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.study_room_credit_segments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.study_room_credit_segments TO authenticated;
DROP POLICY IF EXISTS "Students can read own credit history" ON public.study_room_credit_segments;
CREATE POLICY "Students can read own credit history"
ON public.study_room_credit_segments FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

-- Server-only trigger maintains pending credit semantics, including a return
-- before midnight and expiry without confirmation.
CREATE OR REPLACE FUNCTION study_room_private.study_room_reconcile_credit_segments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF COALESCE(OLD.session_away_pending_seconds, 0) > 0
    AND COALESCE(NEW.session_away_pending_seconds, 0) = 0
    AND OLD.session_id IS NOT NULL THEN

    IF NEW.session_expired_at IS NOT NULL
       AND NEW.session_expired_at IS DISTINCT FROM OLD.session_expired_at THEN
      DELETE FROM public.study_room_credit_segments
      WHERE user_id = OLD.user_id
        AND session_id = OLD.session_id
        AND pending = true
        AND local_day = OLD.session_away_pending_date;
      -- The previous day's away credits were preserved by the server, too.
      UPDATE public.study_room_credit_segments SET pending = false
      WHERE user_id = OLD.user_id AND session_id = OLD.session_id AND pending = true;
    ELSE
      UPDATE public.study_room_credit_segments SET pending = false
      WHERE user_id = OLD.user_id AND session_id = OLD.session_id AND pending = true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS study_room_reconcile_credit_segments ON public.study_room_members;
CREATE TRIGGER study_room_reconcile_credit_segments
AFTER UPDATE ON public.study_room_members FOR EACH ROW
EXECUTE FUNCTION study_room_private.study_room_reconcile_credit_segments();

CREATE OR REPLACE FUNCTION study_room_private.credit_session_interval(p_user_id uuid, p_from timestamp with time zone, p_until timestamp with time zone, p_is_away boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  current_row public.study_room_members%rowtype;
  v_local_day date := timezone('Asia/Colombo', p_until)::date;
  v_monday date := public.study_room_local_week_start(timezone('Asia/Colombo', p_until)::date);
  elapsed_total integer;
  elapsed_today integer;
  elapsed_week integer;
BEGIN
  IF p_until IS NULL OR p_from IS NULL OR p_until <= p_from THEN
    RETURN;
  END IF;

  SELECT * INTO current_row
  FROM public.study_room_members
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT
    coalesce(sum(parts.seconds), 0)::integer,
    coalesce(sum(parts.seconds) FILTER (WHERE parts.local_day = v_local_day), 0)::integer,
    coalesce(sum(parts.seconds) FILTER (WHERE parts.local_week = v_monday), 0)::integer
  INTO elapsed_total, elapsed_today, elapsed_week
  FROM study_room_private.split_credit_seconds(p_from, p_until) AS parts;

  -- The source of truth for cross-device per-subject/day history.
  -- The same interval and day splitter as the leaderboard guarantees parity.
  INSERT INTO public.study_room_credit_segments
    (user_id, session_id, local_day, subject, credited_from, credited_until, seconds, pending)
  SELECT
    p_user_id,
    coalesce(current_row.session_id, current_row.user_id),
    part.local_day,
    coalesce(nullif(current_row.subject, ''), 'Other'),
    greatest(p_from, part.local_day::timestamp at time zone 'Asia/Colombo'),
    least(p_until, (part.local_day + 1)::timestamp at time zone 'Asia/Colombo'),
    part.seconds,
    p_is_away
  FROM study_room_private.split_credit_seconds(p_from, p_until) AS part;

  UPDATE public.study_room_members
  SET
    today_seconds = CASE
      WHEN today_date = v_local_day THEN coalesce(today_seconds, 0) + elapsed_today
      ELSE elapsed_today
    END,
    today_date = v_local_day,
    week_seconds = CASE
      WHEN week_start = v_monday THEN coalesce(week_seconds, 0) + elapsed_week
      ELSE elapsed_week
    END,
    week_start = v_monday,
    session_elapsed_seconds = coalesce(current_row.session_elapsed_seconds, 0) + elapsed_total,
    session_date = v_local_day,
    session_today_seconds = CASE
      WHEN current_row.session_today_date = v_local_day
        THEN coalesce(current_row.session_today_seconds, 0) + elapsed_today
      ELSE elapsed_today
    END,
    session_today_date = v_local_day,
    session_week_seconds = CASE
      WHEN current_row.session_week_start = v_monday
        THEN coalesce(current_row.session_week_seconds, 0) + elapsed_week
      ELSE elapsed_week
    END,
    session_week_start = v_monday,
    session_away_pending_seconds = CASE
      WHEN p_is_away THEN
        CASE
          WHEN current_row.session_away_pending_date = v_local_day
            THEN coalesce(current_row.session_away_pending_seconds, 0) + elapsed_today
          ELSE elapsed_today
        END
      ELSE coalesce(current_row.session_away_pending_seconds, 0)
    END,
    session_away_pending_date = CASE
      WHEN p_is_away THEN v_local_day
      ELSE current_row.session_away_pending_date
    END,
    session_away_pending_week_start = CASE
      WHEN p_is_away THEN v_monday
      ELSE current_row.session_away_pending_week_start
    END,
    last_heartbeat_at = p_until,
    updated_at = p_until
  WHERE user_id = p_user_id;
END;
$function$
;

-- RLS is applied as caller for both views, so students can only read their own.
CREATE OR REPLACE VIEW public.study_room_personal_daily
WITH (security_invoker = true) AS
SELECT user_id, local_day, subject, sum(seconds)::bigint AS seconds
FROM public.study_room_credit_segments
WHERE NOT pending
GROUP BY user_id, local_day, subject;

CREATE OR REPLACE VIEW public.study_room_personal_sessions
WITH (security_invoker = true) AS
SELECT user_id, session_id, subject,
       min(credited_from) AS started_at,
       max(credited_until) AS ended_at,
       sum(seconds)::bigint AS seconds
FROM public.study_room_credit_segments
WHERE NOT pending
GROUP BY user_id, session_id, subject;

REVOKE ALL ON public.study_room_personal_daily FROM PUBLIC, anon;
REVOKE ALL ON public.study_room_personal_sessions FROM PUBLIC, anon;
GRANT SELECT ON public.study_room_personal_daily TO authenticated;
GRANT SELECT ON public.study_room_personal_sessions TO authenticated;
