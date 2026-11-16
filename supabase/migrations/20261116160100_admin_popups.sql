-- PR #102: one-time admin pop-up messages. Publishing changes live content
-- only when an administrator invokes the RPC; installation publishes none.
begin;
create table public.studylab_popups (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  message text not null check (char_length(message) between 1 and 800),
  variant text not null default 'info'
    check (variant in ('info','success','warning','important','custom')),
  placement text not null default 'top-right'
    check (placement in ('top-right','top-center','center','bottom-right')),
  display_seconds integer not null default 8
    check (display_seconds between 3 and 30),
  link text not null default '',
  starts_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  constraint popup_schedule check (starts_at < created_at + interval '31 days'),
  constraint popup_link check (
    link='' or
    (length(link)<=2048 and link !~ '[[:space:][:cntrl:]\\]'
      and link !~ '^//' and
      (link ~ '^https://[^/@]+(/|$)' or link ~ '^/[a-zA-Z0-9/_#.?!=&%-]+$'))
  )
);
create index studylab_popups_start_idx on public.studylab_popups(starts_at desc);
alter table public.studylab_popups enable row level security;
revoke all on public.studylab_popups from anon,authenticated;
grant select on public.studylab_popups to anon,authenticated;
create policy "Only active StudyLab popups readable"
 on public.studylab_popups for select to anon,authenticated
 using (starts_at<=now() and now()<starts_at+interval '24 hours');

create table studylab_private.popup_receipts (
  popup_id uuid not null references public.studylab_popups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (popup_id,user_id)
);
alter table studylab_private.popup_receipts enable row level security;
create index popup_receipts_user_idx on studylab_private.popup_receipts(user_id);

-- Atomically claim an eligible message once for this Supabase identity.
-- Failed/duplicate claims never return the message to the caller.
create function public.studylab_popup_claim(p_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_claimed integer;
begin
  if auth.uid() is null then return false; end if;
  insert into studylab_private.popup_receipts (popup_id,user_id)
  select p.id,auth.uid() from public.studylab_popups p
   where p.id=p_id and p.starts_at<=now()
     and now()<p.starts_at+interval '24 hours'
  on conflict do nothing;
  get diagnostics v_claimed = row_count;
  return v_claimed=1;
end;
$$;
revoke all on function public.studylab_popup_claim(uuid) from public,anon;
grant execute on function public.studylab_popup_claim(uuid) to authenticated;

create function public.studylab_admin_popup_list()
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
        link,starts_at,created_at,
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
  p_link text default '', p_starts_at timestamptz default null
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
     p_link is null or length(p_link)>2048 or
     (p_link<>'' and (p_link ~ '[[:space:][:cntrl:]\\]' or
       p_link ~ '^//' or not (p_link ~ '^https://[^/@]+(/|$)' or
       p_link ~ '^/[a-zA-Z0-9/_#.?!=&%-]+$'))) then
    raise exception 'Invalid popup settings' using errcode='22023';
  end if;
  if p_action='create' then
    if coalesce(p_starts_at,now()) < now()-interval '5 minutes'
       or coalesce(p_starts_at,now()) > now()+interval '30 days' then
      raise exception 'Scheduled time must be within the next 30 days';
    end if;
    insert into public.studylab_popups(
      title,message,variant,placement,display_seconds,link,starts_at,created_by
    ) values (
      btrim(p_title),btrim(p_message),p_variant,p_placement,p_seconds,
      p_link,coalesce(p_starts_at,now()),auth.uid()
    ) returning id into v_id;
  else
    update public.studylab_popups set
      title=btrim(p_title),message=btrim(p_message),variant=p_variant,
      placement=p_placement,display_seconds=p_seconds,link=p_link
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
revoke all on function public.studylab_admin_popup_list() from public,anon;
revoke all on function public.studylab_admin_popup_set(
  text,uuid,text,text,text,text,integer,text,timestamptz) from public,anon;
grant execute on function public.studylab_admin_popup_list() to authenticated;
grant execute on function public.studylab_admin_popup_set(
  text,uuid,text,text,text,text,integer,text,timestamptz) to authenticated;
commit;
