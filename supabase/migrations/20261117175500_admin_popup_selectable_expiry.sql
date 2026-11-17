-- PR #108 admin popup visibility duration. STAGED ONLY; NOT APPLIED to production.
-- Existing messages default to 24h; their receipts and all audit history remain.
-- Actual visibility/claim expiry is enforced in database RLS and RPCs.
BEGIN;
ALTER TABLE public.studylab_popups
  ADD COLUMN expiry_period text NOT NULL DEFAULT '24h',
  ADD COLUMN expires_at timestamptz;
ALTER TABLE public.studylab_popups
  ADD CONSTRAINT studylab_popup_expiry_period_chk
  CHECK (expiry_period IN ('24h','7d','1m','3m','6m','9m','1y'));

CREATE FUNCTION studylab_private.popup_compute_expiry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  NEW.expires_at := NEW.starts_at +
    CASE NEW.expiry_period
      WHEN '24h' THEN interval '24 hours'
      WHEN '7d'  THEN interval '7 days'
      WHEN '1m'  THEN interval '1 month'
      WHEN '3m'  THEN interval '3 months'
      WHEN '6m'  THEN interval '6 months'
      WHEN '9m'  THEN interval '9 months'
      WHEN '1y'  THEN interval '1 year'
      ELSE NULL
    END;
  IF NEW.expires_at IS NULL OR NEW.expires_at <= NEW.starts_at THEN
    RAISE EXCEPTION 'Invalid pop-up expiry period' USING errcode='22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION studylab_private.popup_compute_expiry() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER studylab_popup_expiry_on_schedule
BEFORE INSERT OR UPDATE OF starts_at, expiry_period ON public.studylab_popups
FOR EACH ROW EXECUTE FUNCTION studylab_private.popup_compute_expiry();

-- Update existing records preserving exactly the prior 24-hour cutoff.
UPDATE public.studylab_popups SET expires_at = starts_at + interval '24 hours';
ALTER TABLE public.studylab_popups ALTER COLUMN expires_at SET NOT NULL;
ALTER TABLE public.studylab_popups
  ADD CONSTRAINT studylab_popup_expiry_after_start_chk CHECK (expires_at > starts_at);

DROP POLICY "Only active StudyLab popups readable" ON public.studylab_popups;
CREATE POLICY "Only active StudyLab popups readable"
ON public.studylab_popups FOR SELECT TO anon,authenticated
USING (starts_at <= now() AND now() < expires_at);

CREATE OR REPLACE FUNCTION public.studylab_popup_claim(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_claimed integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  INSERT INTO studylab_private.popup_receipts(popup_id,user_id)
  SELECT p.id,auth.uid() FROM public.studylab_popups p
   WHERE p.id=p_id AND p.starts_at<=now() AND now()<p.expires_at
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_claimed=ROW_COUNT;
  RETURN v_claimed=1;
END;
$$;
REVOKE ALL ON FUNCTION public.studylab_popup_claim(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.studylab_popup_claim(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.studylab_admin_popup_list()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  IF NOT public.studylab_social_is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING errcode='42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(t) ORDER BY t.starts_at DESC)
    FROM (
      SELECT id,title,message,variant,placement,display_seconds,
        link,link_label,starts_at,created_at,expiry_period,expires_at,
        (SELECT count(*) FROM studylab_private.popup_receipts s
          WHERE s.popup_id=p.id) AS delivered
      FROM public.studylab_popups p
      ORDER BY starts_at DESC LIMIT 100
    ) t
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.studylab_admin_popup_list() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.studylab_admin_popup_list() TO authenticated;

-- New additive admin RPC, leaving the old v2 admin wrapper and all older
-- saved clients operational. The original v2 setter validates all existing
-- fields and writes the usual audit event; this RPC sets the expiry atomically
-- and attaches the full before/after snapshot for the existing Undo feature.
CREATE FUNCTION public.studylab_admin_popup_action_v3(
  p_action text, p_data jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_period text := coalesce(p_data->>'expiry_period','24h');
  v_pid uuid := nullif(p_data->>'id','')::uuid;
  v_before jsonb;
  v_after jsonb;
  v_result jsonb;
  v_audit_id bigint;
BEGIN
  IF NOT public.studylab_social_is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING errcode='42501';
  END IF;
  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' THEN
    RAISE EXCEPTION 'Invalid pop-up data' USING errcode='22023';
  END IF;
  IF p_action NOT IN ('create','update','delete') THEN
    RAISE EXCEPTION 'Invalid pop-up action' USING errcode='22023';
  END IF;
  IF p_action <> 'delete' AND v_period NOT IN
    ('24h','7d','1m','3m','6m','9m','1y') THEN
    RAISE EXCEPTION 'Invalid pop-up expiry' USING errcode='22023';
  END IF;
  IF v_pid IS NOT NULL THEN
    SELECT to_jsonb(t) INTO v_before FROM public.studylab_popups t WHERE id=v_pid;
  END IF;

  v_result := public.studylab_admin_popup_set_v2(
    p_action=>p_action,
    p_id=>v_pid,
    p_title=>coalesce(p_data->>'title',''),
    p_message=>coalesce(p_data->>'message',''),
    p_variant=>coalesce(p_data->>'variant','info'),
    p_placement=>coalesce(p_data->>'placement','top-right'),
    p_seconds=>coalesce((p_data->>'display_seconds')::integer,8),
    p_link=>coalesce(p_data->>'link',''),
    p_starts_at=>nullif(p_data->>'starts_at','')::timestamptz,
    p_link_label=>coalesce(p_data->>'link_label','View')
  );

  IF p_action <> 'delete' THEN
    v_pid := (v_result->>'id')::uuid;
    UPDATE public.studylab_popups SET expiry_period=v_period WHERE id=v_pid;
    SELECT to_jsonb(t) INTO v_after FROM public.studylab_popups t WHERE id=v_pid;
    SELECT id INTO v_audit_id FROM studylab_private.activity
      WHERE actor=auth.uid() AND audit_txid=txid_current()
      ORDER BY id DESC LIMIT 1 FOR UPDATE;
    IF v_audit_id IS NULL THEN RAISE EXCEPTION 'Audit record unavailable'; END IF;
    UPDATE studylab_private.activity
      SET undo_snapshot=jsonb_build_object(
        'type','popup','id',v_pid,'before',v_before,'after',v_after
      ) WHERE id=v_audit_id;
    RETURN v_after;
  END IF;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.studylab_admin_popup_action_v3(text,jsonb)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.studylab_admin_popup_action_v3(text,jsonb)
  TO authenticated;
COMMIT;
