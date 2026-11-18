-- PR #109: reliable StudyLab pop-up delivery, display lifetime, and storage cleanup.
-- display_seconds=0 means "Until dismissed"; 3..60 are timed choices.
-- Keep existing messages and receipt history intact during deployment.
BEGIN;
ALTER TABLE public.studylab_popups
  DROP CONSTRAINT studylab_popups_display_seconds_check;
ALTER TABLE public.studylab_popups
  ADD CONSTRAINT studylab_popups_display_seconds_check
  CHECK (display_seconds = 0 OR display_seconds BETWEEN 3 AND 60);

-- Retain the prior administrative validation, admin gate, audit actions,
-- URL checks, and delete-by-ID behavior. Only the duration check changes.
CREATE OR REPLACE FUNCTION public.studylab_admin_popup_set_v2(p_action text, p_id uuid DEFAULT NULL::uuid, p_title text DEFAULT ''::text, p_message text DEFAULT ''::text, p_variant text DEFAULT 'info'::text, p_placement text DEFAULT 'top-right'::text, p_seconds integer DEFAULT 8, p_link text DEFAULT ''::text, p_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_link_label text DEFAULT 'View'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_result jsonb;
begin
  if not public.studylab_social_is_admin() then
    raise exception 'Admin access required' using errcode='42501';
  end if;
  if coalesce(p_action,'') not in ('create','update','delete') then
    raise exception 'Invalid popup action' using errcode='22023';
  end if;
  if p_action='delete' then
    delete from public.studylab_popups where id=p_id returning id into v_id;
    if v_id is null then raise exception 'Pop-up not found'; end if;
    insert into studylab_private.activity(actor,action,target)
      values(auth.uid(),'Delete pop-up',v_id::text);
    return jsonb_build_object('deleted',true,'id',v_id);
  end if;
  if length(btrim(coalesce(p_title,''))) not between 1 and 120 or
     length(btrim(coalesce(p_message,''))) not between 1 and 800 or
     p_variant not in ('info','success','warning','important','custom') or
     p_placement not in ('top-right','top-center','center','bottom-right') or
     (p_seconds <> 0 AND p_seconds NOT BETWEEN 3 AND 60) or
     p_link_label is null or length(btrim(p_link_label)) not between 1 and 20 or
     p_link_label ~ '[<>[:cntrl:]]' or
     p_link is null or length(p_link)>2048 or
     (p_link<>'' and (p_link ~ '[[:space:][:cntrl:]\\]' or
       p_link ~ '^//' or not (p_link ~ '^https?://[^/@]+(/|$)' or
       p_link ~ '^/[a-zA-Z0-9/_#.?!=&%-]+$'))) then
    raise exception 'Invalid popup settings' using errcode='22023';
  end if;
  if p_action='create' then
    if coalesce(p_starts_at,now()) < now()-interval '5 minutes'
       or coalesce(p_starts_at,now()) > now()+interval '30 days' then
      raise exception 'Scheduled time must be within the next 30 days';
    end if;
    insert into public.studylab_popups(
      title,message,variant,placement,display_seconds,link,link_label,starts_at,created_by
    ) values (
      btrim(p_title),btrim(p_message),p_variant,p_placement,p_seconds,
      p_link,btrim(p_link_label),coalesce(p_starts_at,now()),auth.uid()
    ) returning id into v_id;
  else
    update public.studylab_popups set
      title=btrim(p_title),message=btrim(p_message),variant=p_variant,
      placement=p_placement,display_seconds=p_seconds,link=p_link,link_label=btrim(p_link_label)
      where id=p_id returning id into v_id;
    if v_id is null then raise exception 'Pop-up not found'; end if;
    -- Original 24-hour expiry and receipt IDs are intentionally unchanged.
  end if;
  insert into studylab_private.activity(actor,action,target)
    values(auth.uid(),case when p_action='create' then 'Publish pop-up'
      else 'Edit pop-up' end,v_id::text);
  select to_jsonb(p) into v_result from public.studylab_popups p where p.id=v_id;
  return v_result;
end;
$function$;

-- A lightweight event reaches students already on Home. The ordinary
-- authenticated SELECT RLS still controls which popup events are visible.
ALTER PUBLICATION supabase_realtime ADD TABLE public.studylab_popups;

-- Deleting a popup (manually or by cleanup) deletes its one-time receipts
-- through the existing ON DELETE CASCADE FK. The independent audit log
-- records remain to support accountability and administrator history.
CREATE FUNCTION studylab_private.purge_expired_popups_weekly()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $purge$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.studylab_popups WHERE expires_at <= now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$purge$;
REVOKE ALL ON FUNCTION studylab_private.purge_expired_popups_weekly()
  FROM PUBLIC, anon, authenticated;

-- Every Monday 02:30 Sri Lanka = Sunday 21:00 UTC.
-- SQL runs in the database; no API requests or Function compute credits.
SELECT cron.schedule(
  'studylab-weekly-popup-expiry-prune',
  '0 21 * * 0',
  $job$SELECT studylab_private.purge_expired_popups_weekly();$job$
);
COMMIT;
