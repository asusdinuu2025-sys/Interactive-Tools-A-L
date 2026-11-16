-- PR #102 refinements: safe ordinary website links and editable action labels.
-- Supports old RPC callers; this migration does not alter existing records.
begin;
alter table public.studylab_popups
  add column link_label text not null default 'View'
  constraint sl_popup_link_label_check check(
    char_length(btrim(link_label)) between 1 and 20 and link_label !~ '[<>[:cntrl:]]'
  );
alter table public.studylab_popups drop constraint if exists popup_link;
alter table public.studylab_popups add constraint popup_link check (
  link='' or (length(link)<=2048 and link !~ '[[:space:][:cntrl:]\\]' and
  link !~ '^//' and
  (link ~ '^https?://[^/@]+(/|$)' or link ~ '^/[a-zA-Z0-9/_#.?!=&%-]+$'))
);
create or replace function public.studylab_admin_content_save(p_id text,p_payload jsonb,p_revision integer,p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare current_revision integer; result jsonb; v_url text;
begin
 if not public.studylab_social_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_id is null or p_id !~ '^[a-zA-Z0-9_-]{1,100}$' or p_action is null or p_action not in ('draft','publish','hide','restore') or p_revision is null or p_revision<0 then raise exception 'Invalid content action'; end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>12000 then raise exception 'Invalid content'; end if;
 if coalesce(p_payload->>'id','')<>p_id or coalesce(p_payload->>'kind','') not in ('card','section') or coalesce(length(btrim(p_payload->>'title')),0) not between 1 and 160 or length(coalesce(p_payload->>'description',''))>1500 then raise exception 'Invalid content fields'; end if;
 if coalesce(p_payload->>'page','') not in ('index.html','maths.html','physics.html','chemistry.html','biology.html','Telegram_Channels.html','lesson-packs.html') or coalesce(p_payload->>'order','') !~ '^[0-9]{1,5}$' or (p_payload->>'order')::int>10000 or coalesce(jsonb_typeof(p_payload->'hidden'),'')<>'boolean' then raise exception 'Invalid page or order'; end if;
 if p_payload->>'kind'='section' and p_payload->>'page'<>'index.html' then raise exception 'Sections belong on Home'; end if;
 if p_payload->>'kind'='card' and coalesce(p_payload->>'url','')='' then raise exception 'A destination is required'; end if;
 if p_payload ? 'button_label' and (
    char_length(btrim(coalesce(p_payload->>'button_label',''))) not between 1 and 22 or
    coalesce(p_payload->>'button_label','') ~ '[<>[:cntrl:]]'
 ) then raise exception 'Button label must be 1–22 plain characters'; end if;
 foreach v_url in array array[coalesce(p_payload->>'url',''),coalesce(p_payload->>'image','')] loop
  if v_url<>'' and (v_url ~ '[[:space:][:cntrl:]\\]' or v_url ~ '^//' or (v_url ~ ':' and v_url !~ '^https?://[^/@]+(/|$)') or v_url ~ '^https?://[^/]*@') then raise exception 'Use HTTPS or site-relative links'; end if;
 end loop;
 if p_payload->>'section' is not null and p_payload->>'section'<>'' and p_payload->>'section' !~ '^[a-zA-Z0-9_-]{1,100}$' then raise exception 'Invalid section'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id,0));
 select revision into current_revision from studylab_private.content where id=p_id for update;
 if coalesce(current_revision,0)<>p_revision then raise exception 'This item changed. Reload before saving.' using errcode='40001'; end if;
 if p_action in ('hide','restore') then p_payload=jsonb_set(p_payload,'{hidden}',to_jsonb(p_action='hide')); end if;
 insert into studylab_private.content(id,draft,revision,published) values(p_id,p_payload,p_revision+1,p_action<>'draft')
 on conflict(id) do update set draft=excluded.draft,revision=excluded.revision,published=studylab_private.content.published or excluded.published;
 if p_action<>'draft' then insert into public.studylab_site_content(id,page,payload) values(p_id,p_payload->>'page',p_payload)
 on conflict(id) do update set page=excluded.page,payload=excluded.payload; end if;
 insert into studylab_private.activity(actor,action,target) values(auth.uid(),p_action,p_payload->>'title');
 select to_jsonb(c) into result from studylab_private.content c where id=p_id;return result;
end;$$;

create or replace function public.studylab_admin_popup_list()
returns jsonb language plpgsql security definer set search_path=''
as $$
begin
  if not public.studylab_social_is_admin() then
    raise exception 'Admin access required' using errcode='42501';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(t) order by t.starts_at desc)
    from (
      select id,title,message,variant,placement,display_seconds,
        link,link_label,starts_at,created_at,
        (starts_at+interval '24 hours') as expires_at,
        (select count(*) from studylab_private.popup_receipts s
          where s.popup_id=p.id) as delivered
      from public.studylab_popups p
      order by starts_at desc limit 100
    ) t
  ),'[]'::jsonb);
end;
$$;


create function public.studylab_admin_popup_set(
  p_action text, p_id uuid default null, p_title text default '',
  p_message text default '', p_variant text default 'info',
  p_placement text default 'top-right', p_seconds integer default 8,
  p_link text default '', p_starts_at timestamptz default null,
  p_link_label text default 'View',
  p_link_label text default 'View'
)
returns jsonb language plpgsql security definer set search_path=''
as $$
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
     p_seconds not between 3 and 30 or
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
$$;

revoke all on function public.studylab_admin_popup_set(
 text,uuid,text,text,text,text,integer,text,timestamptz,text) from public,anon;
grant execute on function public.studylab_admin_popup_set(
 text,uuid,text,text,text,text,integer,text,timestamptz,text) to authenticated;
commit;
