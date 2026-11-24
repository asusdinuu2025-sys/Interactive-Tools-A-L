-- Proposed additive Plus foundation; apply only after authorization review.
-- No billing provider or payment writes are enabled by this migration.
begin;
create table public.studylab_plus_settings (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false
);
insert into public.studylab_plus_settings(singleton) values(true);
create table public.studylab_plus_grants (
 user_id uuid primary key references auth.users(id) on delete cascade,
 expires_at timestamptz,
 granted_by uuid references auth.users(id) on delete set null,
 granted_at timestamptz not null default now()
);
create table public.studylab_plus_audit (
 id bigint generated always as identity primary key,
 user_id uuid references auth.users(id) on delete set null,
 actor_id uuid references auth.users(id) on delete set null,
 action text not null check(action in ('grant','extend','revoke','enable','disable')),
 created_at timestamptz not null default now(),
 expires_at timestamptz
);
alter table public.studylab_plus_settings enable row level security;
alter table public.studylab_plus_grants enable row level security;
alter table public.studylab_plus_audit enable row level security;
revoke all on public.studylab_plus_settings,public.studylab_plus_grants,public.studylab_plus_audit from public,anon,authenticated;
create function public.studylab_plus_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); g public.studylab_plus_grants%rowtype; enabled boolean;
begin
 if uid is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select s.enabled into enabled from public.studylab_plus_settings s where singleton;
 select * into g from public.studylab_plus_grants where user_id=uid;
 return jsonb_build_object('enabled',enabled,'active',enabled and g.user_id is not null and (g.expires_at is null or g.expires_at>now()),'granted',g.user_id is not null and (g.expires_at is null or g.expires_at>now()),'expires_at',g.expires_at,'billing_ready',false);
end; $$;
create function public.studylab_plus_admin_status(p_user uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare g public.studylab_plus_grants%rowtype; enabled boolean; total bigint;
begin
 if auth.uid() is null or not public.studylab_social_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 select s.enabled into enabled from public.studylab_plus_settings s where singleton;
 select count(*) into total from public.studylab_plus_grants where expires_at is null or expires_at>now();
 select * into g from public.studylab_plus_grants where user_id=p_user;
 return jsonb_build_object('enabled',enabled,'complimentary_count',total,'granted',g.user_id is not null and (g.expires_at is null or g.expires_at>now()),'expires_at',g.expires_at,'billing_ready',false);
end; $$;
create function public.studylab_plus_admin_grant(p_user uuid,p_days integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); old public.studylab_plus_grants%rowtype; expiry timestamptz; operation text;
begin
 if uid is null or not public.studylab_social_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_days is null or p_days not in (-1,0,7,30,90,365) then raise exception 'Invalid membership duration'; end if;
 if not exists(select 1 from auth.users u join public.studylab_profiles p on p.id=u.id where u.id=p_user and not coalesce(u.is_anonymous,false) and p.deleted_at is null) then raise exception 'Registered profile required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,129));
 select * into old from public.studylab_plus_grants where user_id=p_user for update;
 if p_days=0 then
  delete from public.studylab_plus_grants where user_id=p_user;
  operation:='revoke';
 else
  if p_days=-1 or (old.user_id is not null and old.expires_at is null) then expiry:=null;
  else expiry:=greatest(now(),coalesce(old.expires_at,now()))+make_interval(days=>p_days); end if;
  operation:=case when old.user_id is not null then 'extend' else 'grant' end;
  insert into public.studylab_plus_grants(user_id,expires_at,granted_by) values(p_user,expiry,uid)
   on conflict(user_id) do update set expires_at=excluded.expires_at,granted_by=excluded.granted_by,granted_at=now();
 end if;
 insert into public.studylab_plus_audit(user_id,actor_id,action,expires_at) values(p_user,uid,operation,expiry);
 return public.studylab_plus_admin_status(p_user);
end; $$;
create function public.studylab_plus_admin_enable(p_enabled boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.studylab_social_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_enabled is null then raise exception 'Choose rollout setting'; end if;
 update public.studylab_plus_settings set enabled=p_enabled where singleton and enabled is distinct from p_enabled;
 if found then insert into public.studylab_plus_audit(actor_id,action) values(auth.uid(),case when p_enabled then 'enable' else 'disable' end); end if;
 return public.studylab_plus_admin_status();
end; $$;
revoke all on function public.studylab_plus_status(),public.studylab_plus_admin_status(uuid),public.studylab_plus_admin_grant(uuid,integer),public.studylab_plus_admin_enable(boolean) from public,anon,authenticated;
grant execute on function public.studylab_plus_status(),public.studylab_plus_admin_status(uuid),public.studylab_plus_admin_grant(uuid,integer),public.studylab_plus_admin_enable(boolean) to authenticated;
commit;
