-- StudyLab Study Room Realtime fan-out reduction.
-- PREVIEW MIGRATION ONLY: do not apply to live Supabase without explicit owner approval.
-- Heartbeat and session-crediting RPCs remain 100% unchanged.
-- The old table remains queryable; only its high-volume Realtime replication is replaced.
BEGIN;

CREATE TABLE public.study_room_change_signals (
  user_id uuid PRIMARY KEY,
  revision bigint NOT NULL DEFAULT 1,
  changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.study_room_change_signals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.study_room_change_signals FROM anon, authenticated;
GRANT SELECT ON public.study_room_change_signals TO authenticated;
CREATE POLICY "Study Room members can receive lightweight state-change signals"
  ON public.study_room_change_signals FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Never broadcast 20-second heartbeats, elapsed-time increments or internal
-- credit accounting as a global event. Only actions that other students must
-- actually learn about send one small notification per affected member.
CREATE FUNCTION study_room_private.signal_visible_member_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  affected_user uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NOT (
    NEW.is_studying IS DISTINCT FROM OLD.is_studying
    OR NEW.session_active IS DISTINCT FROM OLD.session_active
    OR NEW.session_presence_state IS DISTINCT FROM OLD.session_presence_state
    OR NEW.subject IS DISTINCT FROM OLD.subject
    OR NEW.today_date IS DISTINCT FROM OLD.today_date
    OR NEW.week_start IS DISTINCT FROM OLD.week_start
    OR NEW.session_expired_at IS DISTINCT FROM OLD.session_expired_at
    OR NEW.session_target_reached_at IS DISTINCT FROM OLD.session_target_reached_at
  ) THEN
    RETURN NEW;
  END IF;

  affected_user := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;
  INSERT INTO public.study_room_change_signals(user_id,revision,changed_at)
  VALUES (affected_user, 1, clock_timestamp())
  ON CONFLICT (user_id) DO UPDATE
    SET revision = public.study_room_change_signals.revision + 1,
        changed_at = EXCLUDED.changed_at;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION study_room_private.signal_visible_member_change()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER study_room_visible_change_signal
AFTER INSERT OR UPDATE OR DELETE ON public.study_room_members
FOR EACH ROW EXECUTE FUNCTION study_room_private.signal_visible_member_change();

-- Retain a single compact event row per existing study-room member. Nothing
-- is copied into another personal timer table or credited twice.
INSERT INTO public.study_room_change_signals(user_id)
SELECT user_id FROM public.study_room_members
ON CONFLICT(user_id) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.study_room_change_signals;
ALTER PUBLICATION supabase_realtime DROP TABLE public.study_room_members;

COMMIT;
