-- PR #102: admin moderation ledger. Auth ban/unban happens ONLY through
-- the authenticated Edge Function using the server secret; never from SQL
-- installation or public browser API. Existing students are not modified.
begin;
create table studylab_private.user_bans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null check (length(reason) between 3 and 500),
  banned_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  duration_hours integer not null check (duration_hours in (24,168,720,876000))
);
alter table studylab_private.user_bans enable row level security;
create index user_bans_expires on studylab_private.user_bans(expires_at);

create function public.studylab_user_ban_status()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_exp timestamptz; v_found boolean;
begin
  if auth.uid() is null then return jsonb_build_object('banned',false); end if;
  select true,expires_at into v_found,v_exp
    from studylab_private.user_bans
    where user_id=auth.uid() and (expires_at is null or expires_at>now());
  return jsonb_build_object('banned',coalesce(v_found,false),
        'expires_at',v_exp);
end;
$$;
revoke all on function public.studylab_user_ban_status() from public,anon;
grant execute on function public.studylab_user_ban_status() to authenticated;

-- Requires a fresh membership check, disallows banning any administrator,
-- including the caller, and disallows banning anonymous guest accounts.
create function public.studylab_admin_ban_preflight(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_guest boolean; v_exists boolean;
begin
  if not public.studylab_social_is_admin() then
    raise exception 'Admin access required' using errcode='42501';
  end if;
  if p_user is null or p_user=auth.uid() then
    raise exception 'You cannot ban your own account';
  end if;
  if exists(select 1 from studylab_private.admins where user_id=p_user) then
    raise exception 'Administrators cannot be banned. Remove the role separately.';
  end if;
  select true,coalesce(is_anonymous,false) into v_exists,v_guest
    from auth.users where id=p_user;
  if not coalesce(v_exists,false) or coalesce(v_guest,true) then
    raise exception 'Select a registered StudyLab account';
  end if;
  return jsonb_build_object('allowed',true);
end;
$$;

create function public.studylab_admin_ban_commit(
  p_user uuid, p_hours integer, p_reason text default ''
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_until timestamptz;
begin
  perform pg_advisory_xact_lock(187641206);
  perform public.studylab_admin_ban_preflight(p_user);
  if p_hours is null or p_hours not in (0,24,168,720,876000) then
    raise exception 'Choose an approved ban duration' using errcode='22023';
  end if;
  if p_hours=0 then
    delete from studylab_private.user_bans where user_id=p_user;
    insert into studylab_private.activity(actor,action,target)
      values(auth.uid(),'Unban account',p_user::text);
    return jsonb_build_object('banned',false);
  end if;
  if length(btrim(coalesce(p_reason,''))) not between 3 and 500 then
    raise exception 'Enter a moderation reason (3–500 characters)'
      using errcode='22023';
  end if;
  v_until := case when p_hours=876000 then null
                  else now()+make_interval(hours=>p_hours) end;
  insert into studylab_private.user_bans(
    user_id,reason,banned_by,expires_at,duration_hours
  ) values (p_user,btrim(p_reason),auth.uid(),v_until,p_hours)
  on conflict(user_id) do update set
     reason=excluded.reason,banned_by=excluded.banned_by,
     created_at=now(),expires_at=excluded.expires_at,
     duration_hours=excluded.duration_hours;
  insert into studylab_private.activity(actor,action,target)
    values(auth.uid(),'Ban account',p_user::text);
  return jsonb_build_object('banned',true,'expires_at',v_until);
end;
$$;
revoke all on function public.studylab_admin_ban_preflight(uuid),
  public.studylab_admin_ban_commit(uuid,integer,text) from public,anon;
grant execute on function public.studylab_admin_ban_preflight(uuid),
  public.studylab_admin_ban_commit(uuid,integer,text) to authenticated;

create or replace function public.studylab_admin_users(
  p_query text default '',p_page integer default 0,p_admins boolean default false
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_result jsonb; v_total bigint;
begin
  if not public.studylab_social_is_admin() then
    raise exception 'Admin access required' using errcode='42501';
  end if;
  if p_page is null or p_page<0 or p_page>100000 or
    length(coalesce(p_query,''))>100 then
    raise exception 'Invalid search' using errcode='22023';
  end if;
  select count(*) into v_total
  from public.studylab_profiles p join auth.users u on u.id=p.id
  where (not coalesce(p_admins,false) or exists(
    select 1 from studylab_private.admins a where a.user_id=p.id
  )) and (coalesce(p.display_name,'')||' '||coalesce(p.username,''))
     ilike '%'||coalesce(p_query,'')||'%';
  select coalesce(jsonb_agg(t),'[]'::jsonb) into v_result
  from (
    select p.id,p.display_name,p.username,p.school,p.bio,p.created_at,
      coalesce(u.is_anonymous,false) as guest,
      exists(select 1 from studylab_private.admins a where a.user_id=p.id) as admin,
      exists(select 1 from public.studylab_verifications v where v.user_id=p.id) as verified,
      exists(select 1 from studylab_private.user_bans b where b.user_id=p.id
        and (b.expires_at is null or b.expires_at>now())) as banned,
      (select b.expires_at from studylab_private.user_bans b
         where b.user_id=p.id and (b.expires_at is null or b.expires_at>now()))
         as ban_expires_at
    from public.studylab_profiles p
      join auth.users u on u.id=p.id
    where (not coalesce(p_admins,false) or exists(
      select 1 from studylab_private.admins a where a.user_id=p.id
    )) and (coalesce(p.display_name,'')||' '||coalesce(p.username,''))
       ilike '%'||coalesce(p_query,'')||'%'
    order by p.created_at desc,p.id limit 20 offset p_page*20
  ) t;
  return jsonb_build_object('rows',v_result,'total',v_total);
end;
$$;
commit;
