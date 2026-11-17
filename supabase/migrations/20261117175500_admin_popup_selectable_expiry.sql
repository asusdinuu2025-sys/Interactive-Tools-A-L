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
-- Preserve the original guarded admin Undo implementation while also
-- restoring a selected pop-up expiry when undoing an edit. Existing snapshots
-- and all other account/content Undo logic remain byte-for-byte equivalent.
CREATE OR REPLACE FUNCTION public.studylab_admin_history_set(p_action text, p_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_event studylab_private.activity%rowtype;
 v_s jsonb;v_type text;v_target text;
 v_priv jsonb;v_pub jsonb;v_current boolean;v_before boolean;
 v_uid uuid;v_field text;v_old_priv jsonb;v_old_pub jsonb;
 v_old_popup jsonb;v_live_popup jsonb;
 v_total integer := 0;
begin
 if not public.studylab_social_is_admin() then
   raise exception 'Admin access required' using errcode='42501';
 end if;
 if p_action='clear_all' then
   update studylab_private.activity set hidden=true where not hidden;
   get diagnostics v_total=row_count;
   return jsonb_build_object('cleared',v_total);
 elsif p_action='clear' then
   if p_id is null then raise exception 'Select a history entry'; end if;
   update studylab_private.activity set hidden=true
     where id=p_id and not hidden;
   get diagnostics v_total=row_count;
   if v_total=0 then raise exception 'History entry unavailable'; end if;
   return jsonb_build_object('cleared',1);
 elsif p_action<>'undo' then
   raise exception 'Unsupported history action' using errcode='22023';
 end if;
 if p_id is null then raise exception 'Choose an action to undo'; end if;
 select * into v_event from studylab_private.activity
   where id=p_id and not hidden for update;
 if not found or v_event.undo_snapshot is null or v_event.undone_at is not null then
   raise exception 'This action cannot be undone safely';
 end if;
 v_s:=v_event.undo_snapshot;v_type:=v_s->>'type';v_target:=v_s->>'id';
 if v_type='content' then
   perform pg_advisory_xact_lock(hashtextextended(v_target,0));
   select to_jsonb(t) into v_priv from studylab_private.content t where id=v_target;
   select to_jsonb(t) into v_pub from public.studylab_site_content t where id=v_target;
   if coalesce(v_priv,'null'::jsonb) is distinct from v_s->'after_private' or
      coalesce(v_pub,'null'::jsonb) is distinct from v_s->'after_public' then
     raise exception 'Content has changed since this action. Reload before undoing.';
   end if;
   v_old_priv:=v_s->'before_private';v_old_pub:=v_s->'before_public';
   delete from studylab_private.content where id=v_target;
   delete from public.studylab_site_content where id=v_target;
   if v_old_priv is distinct from 'null'::jsonb then
     insert into studylab_private.content(id,draft,revision,published)
       values(v_target,v_old_priv->'draft',
         greatest(coalesce((v_priv->>'revision')::integer,0),
                  (v_old_priv->>'revision')::integer)+1,
         (v_old_priv->>'published')::boolean);
   end if;
   if v_old_pub is distinct from 'null'::jsonb then
     insert into public.studylab_site_content(id,page,payload)
       values(v_target,v_old_pub->>'page',v_old_pub->'payload');
   end if;
 elsif v_type='user' then
   v_uid:=v_target::uuid;v_field:=v_s->>'field';
   v_before:=(v_s->>'before')::boolean;
   if v_field='admin' then
     select exists(select 1 from studylab_private.admins where user_id=v_uid) into v_current;
   else
     select exists(select 1 from public.studylab_verifications where user_id=v_uid) into v_current;
   end if;
   if v_current is distinct from (v_s->>'after')::boolean then
     raise exception 'Account permissions changed after this action. Undo is unavailable.';
   end if;
   perform public.studylab_admin_user_set(v_uid,v_field,v_before);
 elsif v_type='popup' then
   v_uid:=v_target::uuid;
   select to_jsonb(t) into v_live_popup from public.studylab_popups t where id=v_uid for update;
   if coalesce(v_live_popup,'null'::jsonb) is distinct from v_s->'after' then
     raise exception 'Pop-up was edited or deleted later. Undo is unavailable.';
   end if;
   v_old_popup:=v_s->'before';
   if v_old_popup='null'::jsonb then
     if exists(select 1 from studylab_private.popup_receipts where popup_id=v_uid) then
       raise exception 'Already delivered. Delete the pop-up to stop future deliveries.';
     end if;
     delete from public.studylab_popups where id=v_uid;
   else
     update public.studylab_popups
       set title=v_old_popup->>'title',
           message=v_old_popup->>'message',
           variant=v_old_popup->>'variant',
           placement=v_old_popup->>'placement',
           display_seconds=(v_old_popup->>'display_seconds')::integer,
           link=v_old_popup->>'link',
           link_label=coalesce(v_old_popup->>'link_label','View'),
           expiry_period=coalesce(v_old_popup->>'expiry_period','24h')
       where id=v_uid;
   end if;
 else
   raise exception 'This operation cannot be undone safely';
 end if;
 update studylab_private.activity set undone_at=now() where id=p_id;
 insert into studylab_private.activity(actor,action,target)
   values(auth.uid(),'Undo '||v_event.action,v_event.target);
 return jsonb_build_object('undone',true,'id',p_id);
end;
$function$


COMMIT;
