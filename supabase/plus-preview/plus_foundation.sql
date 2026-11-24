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
 if uid is null or not exists(select 1 from auth.users u join public.studylab_profiles p on p.id=u.id where u.id=uid and not coalesce(u.is_anonymous,false) and p.deleted_at is null) then raise exception 'Registered profile required' using errcode='42501'; end if;
 select s.enabled into enabled from public.studylab_plus_settings s where singleton;
 select * into g from public.studylab_plus_grants where user_id=uid;
 return jsonb_build_object('enabled',enabled,'active',enabled and g.user_id is not null and (g.expires_at is null or g.expires_at>now()),'granted',g.user_id is not null and (g.expires_at is null or g.expires_at>now()),'expires_at',g.expires_at,'billing_ready',false);
end; $$;
create function public.studylab_plus_admin_status(p_user uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare g public.studylab_plus_grants%rowtype; enabled boolean; total bigint;
begin
 if auth.uid() is null or not coalesce(public.studylab_social_is_admin(),false) then raise exception 'Admin access required' using errcode='42501'; end if;
 select s.enabled into enabled from public.studylab_plus_settings s where singleton;
 select count(*) into total from public.studylab_plus_grants where expires_at is null or expires_at>now();
 select * into g from public.studylab_plus_grants where user_id=p_user;
 return jsonb_build_object('enabled',enabled,'complimentary_count',total,'granted',g.user_id is not null and (g.expires_at is null or g.expires_at>now()),'expires_at',g.expires_at,'billing_ready',false);
end; $$;
create function public.studylab_plus_admin_grant(p_user uuid,p_days integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); old public.studylab_plus_grants%rowtype; expiry timestamptz; operation text;
begin
 if uid is null or not coalesce(public.studylab_social_is_admin(),false) then raise exception 'Admin access required' using errcode='42501'; end if;
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
 if auth.uid() is null or not coalesce(public.studylab_social_is_admin(),false) then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_enabled is null then raise exception 'Choose rollout setting'; end if;
 update public.studylab_plus_settings set enabled=p_enabled where singleton and enabled is distinct from p_enabled;
 if found then insert into public.studylab_plus_audit(actor_id,action) values(auth.uid(),case when p_enabled then 'enable' else 'disable' end); end if;
 return public.studylab_plus_admin_status();
end; $$;
revoke all on function public.studylab_plus_status(),public.studylab_plus_admin_status(uuid),public.studylab_plus_admin_grant(uuid,integer),public.studylab_plus_admin_enable(boolean) from public,anon,authenticated;
grant execute on function public.studylab_plus_status(),public.studylab_plus_admin_status(uuid),public.studylab_plus_admin_grant(uuid,integer),public.studylab_plus_admin_enable(boolean) to authenticated;
-- Preset-only appearance; no user-supplied CSS, images or arbitrary URLs.
create table public.studylab_plus_appearance (
 user_id uuid primary key references auth.users(id) on delete cascade,
 cover text not null default 'default' check(cover in ('default','aurora','ocean','sunset','galaxy','nebula','starlight','mountains','forest','sakura','midnight','prism')),
 frame text not null default 'default' check(frame in ('default','violet','cyan','gold','rose','mint','silver','rainbow') or frame ~ '^#[0-9a-fA-F]{6}
);
alter table public.studylab_plus_appearance enable row level security;
revoke all on public.studylab_plus_appearance from public,anon,authenticated;
-- Public-facing cosmetic projection only. Never returns grants, expiry or billing information for other accounts.
create function public.studylab_plus_profile_state(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare active boolean; appearance public.studylab_plus_appearance%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from auth.users u where u.id=auth.uid() and not coalesce(u.is_anonymous,false)) then
  return jsonb_build_object('active',false);
 end if;
 select exists(select 1 from public.studylab_plus_settings s join public.studylab_plus_grants g on g.user_id=p_user join auth.users u on u.id=g.user_id join public.studylab_profiles p on p.id=u.id
 where s.singleton and s.enabled and not coalesce(u.is_anonymous,false) and p.deleted_at is null and (g.expires_at is null or g.expires_at>now())) into active;
 if not active then return jsonb_build_object('active',false); end if;
 select * into appearance from public.studylab_plus_appearance where user_id=p_user;
 return jsonb_build_object('active',true,'cover',coalesce(appearance.cover,'default'),'frame',coalesce(appearance.frame,'default'));
end; $$;
create function public.studylab_plus_save_appearance(p_cover text,p_frame text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null or not coalesce((public.studylab_plus_status()->>'active')::boolean,false) then raise exception 'Active Plus required' using errcode='42501'; end if;
 if p_cover is null or p_cover not in ('default','aurora','ocean','sunset','galaxy','nebula','starlight','mountains','forest','sakura','midnight','prism') or p_frame is null or (p_frame not in ('default','violet','cyan','gold','rose','mint','silver','rainbow') and p_frame !~ '^#[0-9a-fA-F]{6} then raise exception 'Invalid appearance'; end if;
 insert into public.studylab_plus_appearance(user_id,cover,frame) values(uid,p_cover,p_frame)
 on conflict(user_id) do update set cover=excluded.cover,frame=excluded.frame;
 return public.studylab_plus_profile_state(uid);
end; $$;
revoke all on function public.studylab_plus_profile_state(uuid),public.studylab_plus_save_appearance(text,text) from public,anon,authenticated;
grant execute on function public.studylab_plus_profile_state(uuid),public.studylab_plus_save_appearance(text,text) to authenticated;

-- Only public cosmetic membership indicators; no subscription or expiry data.
create function public.studylab_plus_badges(p_users uuid[]) returns uuid[]
language plpgsql stable security definer set search_path='' as $$
declare result uuid[];
begin
 if auth.uid() is null or not exists(select 1 from auth.users u where u.id=auth.uid() and not coalesce(u.is_anonymous,false)) or coalesce(cardinality(p_users),0)>100 then return array[]::uuid[]; end if;
 select coalesce(array_agg(g.user_id),array[]::uuid[]) into result
 from public.studylab_plus_grants g join public.studylab_plus_settings s on s.singleton and s.enabled
 join auth.users u on u.id=g.user_id join public.studylab_profiles p on p.id=u.id
 where g.user_id=any(p_users) and not coalesce(u.is_anonymous,false) and p.deleted_at is null and (g.expires_at is null or g.expires_at>now());
 return result;
end; $$;
revoke all on function public.studylab_plus_badges(uuid[]) from public,anon,authenticated;
grant execute on function public.studylab_plus_badges(uuid[]) to authenticated;

commit;
)
);
alter table public.studylab_plus_appearance enable row level security;
revoke all on public.studylab_plus_appearance from public,anon,authenticated;
-- Public-facing cosmetic projection only. Never returns grants, expiry or billing information for other accounts.
create function public.studylab_plus_profile_state(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare active boolean; appearance public.studylab_plus_appearance%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from auth.users u where u.id=auth.uid() and not coalesce(u.is_anonymous,false)) then
  return jsonb_build_object('active',false);
 end if;
 select exists(select 1 from public.studylab_plus_settings s join public.studylab_plus_grants g on g.user_id=p_user join auth.users u on u.id=g.user_id join public.studylab_profiles p on p.id=u.id
 where s.singleton and s.enabled and not coalesce(u.is_anonymous,false) and p.deleted_at is null and (g.expires_at is null or g.expires_at>now())) into active;
 if not active then return jsonb_build_object('active',false); end if;
 select * into appearance from public.studylab_plus_appearance where user_id=p_user;
 return jsonb_build_object('active',true,'cover',coalesce(appearance.cover,'default'),'frame',coalesce(appearance.frame,'default'));
end; $$;
create function public.studylab_plus_save_appearance(p_cover text,p_frame text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null or not coalesce((public.studylab_plus_status()->>'active')::boolean,false) then raise exception 'Active Plus required' using errcode='42501'; end if;
 if p_cover is null or p_cover not in ('default','aurora','ocean','sunset','galaxy','nebula','starlight','mountains','forest','sakura','midnight','prism') or p_frame is null or p_frame not in ('default','violet','cyan','gold') then raise exception 'Invalid appearance'; end if;
 insert into public.studylab_plus_appearance(user_id,cover,frame) values(uid,p_cover,p_frame)
 on conflict(user_id) do update set cover=excluded.cover,frame=excluded.frame;
 return public.studylab_plus_profile_state(uid);
end; $$;
revoke all on function public.studylab_plus_profile_state(uuid),public.studylab_plus_save_appearance(text,text) from public,anon,authenticated;
grant execute on function public.studylab_plus_profile_state(uuid),public.studylab_plus_save_appearance(text,text) to authenticated;

commit;
) then raise exception 'Invalid appearance'; end if;
 insert into public.studylab_plus_appearance(user_id,cover,frame) values(uid,p_cover,p_frame)
 on conflict(user_id) do update set cover=excluded.cover,frame=excluded.frame;
 return public.studylab_plus_profile_state(uid);
end; $$;
revoke all on function public.studylab_plus_profile_state(uuid),public.studylab_plus_save_appearance(text,text) from public,anon,authenticated;
grant execute on function public.studylab_plus_profile_state(uuid),public.studylab_plus_save_appearance(text,text) to authenticated;

commit;
)
);
alter table public.studylab_plus_appearance enable row level security;
revoke all on public.studylab_plus_appearance from public,anon,authenticated;
-- Public-facing cosmetic projection only. Never returns grants, expiry or billing information for other accounts.
create function public.studylab_plus_profile_state(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare active boolean; appearance public.studylab_plus_appearance%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from auth.users u where u.id=auth.uid() and not coalesce(u.is_anonymous,false)) then
  return jsonb_build_object('active',false);
 end if;
 select exists(select 1 from public.studylab_plus_settings s join public.studylab_plus_grants g on g.user_id=p_user join auth.users u on u.id=g.user_id join public.studylab_profiles p on p.id=u.id
 where s.singleton and s.enabled and not coalesce(u.is_anonymous,false) and p.deleted_at is null and (g.expires_at is null or g.expires_at>now())) into active;
 if not active then return jsonb_build_object('active',false); end if;
 select * into appearance from public.studylab_plus_appearance where user_id=p_user;
 return jsonb_build_object('active',true,'cover',coalesce(appearance.cover,'default'),'frame',coalesce(appearance.frame,'default'));
end; $$;
create function public.studylab_plus_save_appearance(p_cover text,p_frame text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null or not coalesce((public.studylab_plus_status()->>'active')::boolean,false) then raise exception 'Active Plus required' using errcode='42501'; end if;
 if p_cover is null or p_cover not in ('default','aurora','ocean','sunset','galaxy','nebula','starlight','mountains','forest','sakura','midnight','prism') or p_frame is null or p_frame not in ('default','violet','cyan','gold') then raise exception 'Invalid appearance'; end if;
 insert into public.studylab_plus_appearance(user_id,cover,frame) values(uid,p_cover,p_frame)
 on conflict(user_id) do update set cover=excluded.cover,frame=excluded.frame;
 return public.studylab_plus_profile_state(uid);
end; $$;
revoke all on function public.studylab_plus_profile_state(uuid),public.studylab_plus_save_appearance(text,text) from public,anon,authenticated;
grant execute on function public.studylab_plus_profile_state(uuid),public.studylab_plus_save_appearance(text,text) to authenticated;

commit;
