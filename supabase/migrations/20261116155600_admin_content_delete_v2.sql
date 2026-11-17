-- PR #102: deletion of CMS cards/extra sections with deterministic tombstones.
-- No records are deleted by installation. Operations require a real admin action.
begin;

create or replace function public.studylab_admin_content_list()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_rows jsonb;
begin
  if not public.studylab_social_is_admin() then
    raise exception 'Admin access required' using errcode='42501';
  end if;
  select
    coalesce((
      select jsonb_agg(to_jsonb(c) ||
        jsonb_build_object('has_draft',c.draft is distinct from p.payload)
        order by c.id)
      from studylab_private.content c
      left join public.studylab_site_content p on p.id=c.id
    ), '[]'::jsonb)
    ||
    coalesce((
      select jsonb_agg(jsonb_build_object('id',id,'deleted',true))
      from public.studylab_site_content
      where payload->>'deleted'='true'
    ),'[]'::jsonb)
  into v_rows;
  return v_rows;
end;
$$;

create function public.studylab_admin_content_delete(
  p_id text, p_page text, p_kind text, p_revision integer, p_builtin boolean
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_revision integer; v_children integer := 0; v_title text;
begin
  if not public.studylab_social_is_admin() then
    raise exception 'Admin access required' using errcode='42501';
  end if;
  if p_id is null or p_id !~ '^[a-zA-Z0-9_-]{1,100}$'
      or p_page not in ('index.html','maths.html','physics.html',
        'chemistry.html','biology.html','Telegram_Channels.html','lesson-packs.html')
      or p_kind not in ('card','section') or p_revision is null or p_revision<0
      or p_builtin is null then
    raise exception 'Invalid delete request' using errcode='22023';
  end if;
  if p_kind='section' and (p_builtin or p_id not like 'custom-%') then
    raise exception 'Built-in sections cannot be deleted. Hide them instead.'
      using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id,0));
  select revision,draft->>'title' into v_revision,v_title
    from studylab_private.content where id=p_id for update;
  if coalesce(v_revision,0)<>p_revision then
    raise exception 'This item changed. Reload before deleting.'
      using errcode='40001';
  end if;

  if p_kind='section' then
    -- Remove cards that belong to the extra section, including unpublished drafts.
    with affected as (
      select id from studylab_private.content
       where draft->>'section'=p_id
      union
      select id from public.studylab_site_content
       where payload->>'section'=p_id
    )
    select count(*) into v_children from affected;
    delete from public.studylab_site_content
      where payload->>'section'=p_id;
    delete from studylab_private.content where draft->>'section'=p_id;
  end if;
  delete from studylab_private.content where id=p_id;
  delete from public.studylab_site_content where id=p_id;

  if p_builtin then
    -- Original cards are in committed HTML. Keep ONLY a minimal deletion
    -- marker so the public reader can remove the static element on refresh.
    insert into public.studylab_site_content(id,page,payload)
    values(p_id,p_page,jsonb_build_object(
      'id',p_id,'page',p_page,'kind',p_kind,'deleted',true))
    on conflict(id) do update set page=excluded.page,payload=excluded.payload;
  end if;
  insert into studylab_private.activity(actor,action,target)
    values(auth.uid(),'Delete '||p_kind,coalesce(v_title,p_id));
  return jsonb_build_object('deleted',true,'builtin',p_builtin,
                            'deleted_children',v_children);
end;
$$;

revoke all on function public.studylab_admin_content_delete(
  text,text,text,integer,boolean) from public,anon;
grant execute on function public.studylab_admin_content_delete(
  text,text,text,integer,boolean) to authenticated;
commit;
