-- PR #102: reversible, revision-checked admin actions and soft-cleared history.
-- History is private and retained for audit; Clear never reverses an action.
-- No existing live changes are undone or hidden during installation.
begin;
alter table studylab_private.activity
  add column hidden boolean not null default false,
  add column undo_snapshot jsonb,
  add column undone_at timestamptz,
  add column audit_txid bigint not null default txid_current();
create index if not exists sladmin_activity_visible_idx
  on studylab_private.activity(hidden,created_at desc,id desc);
create or replace function public.studylab_admin_activity()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
 if not public.studylab_social_is_admin() then
   raise exception 'Admin access required' using errcode='42501';
 end if;
 return coalesce((select jsonb_agg(to_jsonb(t) order by t.id desc)
   from (select id,actor,action,target,created_at,undone_at,
       (undo_snapshot is not null and undone_at is null) as can_undo
     from studylab_private.activity where not hidden
     order by id desc limit 200) t),'[]'::jsonb);
end;
$$;
-- Each action is executed and its old/new state saved in one transaction.
-- The original authenticated functions retain the normal permission checks.
create function public.studylab_admin_action_v2(p_kind text,p_action text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_result jsonb := '{}'::jsonb;
 v_item jsonb; v_id text; v_page text; v_kind text;
 v_revision integer; v_builtin boolean;
 v_user uuid; v_field text; v_value boolean; v_old boolean; v_new boolean;
 v_pid uuid; v_before jsonb; v_after jsonb;
 v_pub_before jsonb; v_pub_after jsonb;
 v_audit_id bigint; v_snapshot jsonb;
begin
 if not public.studylab_social_is_admin() then
   raise exception 'Admin access required' using errcode='42501';
 end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then
   raise exception 'Invalid admin action payload' using errcode='22023';
 end if;

 if p_kind='content' then
   if p_action='delete' then
     v_id:=p_data->>'id';v_page:=p_data->>'page';
     v_kind:=p_data->>'kind';v_revision:=(p_data->>'revision')::integer;
     v_builtin:=(p_data->>'builtin')::boolean;
     select to_jsonb(t) into v_before from studylab_private.content t where t.id=v_id;
     select to_jsonb(t) into v_pub_before from public.studylab_site_content t where t.id=v_id;
     v_result:=public.studylab_admin_content_delete(v_id,v_page,v_kind,v_revision,v_builtin);
   elsif p_action in ('draft','publish','hide','restore') then
     v_item:=p_data->'item';v_id:=v_item->>'id';
     v_revision:=(p_data->>'revision')::integer;
     select to_jsonb(t) into v_before from studylab_private.content t where t.id=v_id;
     select to_jsonb(t) into v_pub_before from public.studylab_site_content t where t.id=v_id;
     v_result:=public.studylab_admin_content_save(v_id,v_item,v_revision,p_action);
   else
     raise exception 'Unsupported content action' using errcode='22023';
   end if;
   if not (p_action='delete' and v_kind='section') then
     select to_jsonb(t) into v_after from studylab_private.content t where t.id=v_id;
     select to_jsonb(t) into v_pub_after from public.studylab_site_content t where t.id=v_id;
     v_snapshot:=jsonb_build_object('type','content','id',v_id,
       'before_private',v_before,'after_private',v_after,
       'before_public',v_pub_before,'after_public',v_pub_after);
   end if;
 elsif p_kind='user' and p_action='set' then
   v_user:=(p_data->>'id')::uuid;v_field:=p_data->>'field';
   v_value:=(p_data->>'value')::boolean;
   if v_field not in ('admin','verified') then
     raise exception 'Unsupported user change' using errcode='22023';
   end if;
   if v_field='admin' then
     select exists(select 1 from studylab_private.admins where user_id=v_user) into v_old;
   else
     select exists(select 1 from public.studylab_verifications where user_id=v_user) into v_old;
   end if;
   perform public.studylab_admin_user_set(v_user,v_field,v_value);
   if v_field='admin' then
     select exists(select 1 from studylab_private.admins where user_id=v_user) into v_new;
   else
     select exists(select 1 from public.studylab_verifications where user_id=v_user) into v_new;
   end if;
   if v_old is distinct from v_new then
     v_snapshot:=jsonb_build_object('type','user','id',v_user,
       'field',v_field,'before',v_old,'after',v_new);
   end if;
   v_result:=jsonb_build_object('ok',true);
 elsif p_kind='popup' and p_action in ('create','update','delete') then
   v_pid:=nullif(p_data->>'id','')::uuid;
   if v_pid is not null then
     select to_jsonb(t) into v_before from public.studylab_popups t where id=v_pid;
   end if;
   v_result:=public.studylab_admin_popup_set_v2(
     p_action=>p_action,p_id=>v_pid,
     p_title=>coalesce(p_data->>'title',''),
     p_message=>coalesce(p_data->>'message',''),
     p_variant=>coalesce(p_data->>'variant','info'),
     p_placement=>coalesce(p_data->>'placement','top-right'),
     p_seconds=>coalesce((p_data->>'display_seconds')::integer,8),
     p_link=>coalesce(p_data->>'link',''),
     p_starts_at=>nullif(p_data->>'starts_at','')::timestamptz,
     p_link_label=>coalesce(p_data->>'link_label','View'));
   v_pid:=(v_result->>'id')::uuid;
   select to_jsonb(t) into v_after from public.studylab_popups t where id=v_pid;
   if p_action<>'delete' then
     v_snapshot:=jsonb_build_object('type','popup','id',v_pid,
       'before',v_before,'after',v_after);
   end if;
 else
   raise exception 'Unsupported admin action' using errcode='22023';
 end if;
 if v_snapshot is not null then
   select id into v_audit_id from studylab_private.activity
   where actor=auth.uid() and audit_txid=txid_current()
   order by id desc limit 1 for update;
   if v_audit_id is null then raise exception 'Audit record unavailable'; end if;
   update studylab_private.activity set undo_snapshot=v_snapshot
     where id=v_audit_id;
 end if;
 return v_result;
end;
$$;

create function public.studylab_admin_history_set(p_action text,p_id bigint default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
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
           link_label=coalesce(v_old_popup->>'link_label','View')
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
$$;
revoke all on function public.studylab_admin_action_v2(text,text,jsonb),
  public.studylab_admin_history_set(text,bigint) from public,anon;
grant execute on function public.studylab_admin_action_v2(text,text,jsonb),
  public.studylab_admin_history_set(text,bigint) to authenticated;
commit;