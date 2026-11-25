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
-- Cosmetics are account-owned, validated, and exposed only through a minimal read projection.
create table public.studylab_plus_appearance (
 user_id uuid primary key references auth.users(id) on delete cascade,
 cover text not null default 'default' check(cover in ('default','aurora','ocean','sunset','galaxy','nebula','starlight','mountains','forest','sakura','midnight','prism')),
 frame text not null default 'default' check(frame in ('default','violet','cyan','gold','rose','mint','silver','rainbow') or frame ~ '^#[0-9a-fA-F]{6}$'),
 effect text not null default 'default' check(effect in ('default','aurora','galaxy','pulse','sakura','ocean')),
 bubble text not null default 'default' check(bubble in ('default','violet','cyan','rose','mint','gold')),
 pet text not null default 'default' check(pet in ('default','nebula','mint','rose','gold')),
 timer text not null default 'standard' check(timer in ('standard','compact','micro')),
 pattern text not null default 'default' check(pattern in ('default','none','science','space','nature','music','books')),
 card_pattern text not null default 'default' check(card_pattern in ('default','none','science','space','nature','music','books')),
 card_glow text not null default 'default' check(card_glow in ('default','none','soft','neon','halo')),
 chat_font text not null default 'default' check(chat_font in ('default','clean','classic','mono','italic','rog')),
 details jsonb not null default '{"shape":"default","eyes":"default","glow":"default","mouth":"default","eyeColor":"default","timerAccent":"default"}'::jsonb check (jsonb_typeof(details)='object' and details ?& array['shape','eyes','glow','mouth','eyeColor','timerAccent'] and details - array['shape','eyes','glow','mouth','eyeColor','timerAccent'] = '{}'::jsonb
 and coalesce(details->>'shape','') in ('default','capsule','square','orb')
 and coalesce(details->>'eyes','') in ('default','round','pixel','star','arc','visor','softsquare','droplet','focused','sleepy','happy','diamond')
 and coalesce(details->>'glow','') in ('default','none','soft','neon','galaxy','spark')
 and coalesce(details->>'mouth','') in ('default','smile','dot','none')
 and coalesce(details->>'eyeColor','') ~ '^(default|#[0-9a-fA-F]{6})$'
 and coalesce(details->>'timerAccent','') = 'default')
);
alter table public.studylab_plus_appearance enable row level security;
revoke all on public.studylab_plus_appearance from public,anon,authenticated;

create function public.studylab_plus_public_styles(p_users uuid[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from auth.users u where u.id=auth.uid() and not coalesce(u.is_anonymous,false)) or coalesce(cardinality(p_users),0)>100 then return '{}'::jsonb; end if;
 select coalesce(jsonb_object_agg(g.user_id::text,jsonb_build_object('active',true,'cover',coalesce(a.cover,'default'),'frame',coalesce(a.frame,'default'),'effect',coalesce(a.effect,'default'),'bubble',coalesce(a.bubble,'default'),'pattern',coalesce(a.pattern,'default'),'cardPattern',coalesce(a.card_pattern,'default'),'cardGlow',coalesce(a.card_glow,'default'),'chatFont',coalesce(a.chat_font,'default'))),'{}'::jsonb) into result
 from public.studylab_plus_grants g join public.studylab_plus_settings s on s.singleton and s.enabled
 join auth.users u on u.id=g.user_id join public.studylab_profiles p on p.id=u.id
 left join public.studylab_plus_appearance a on a.user_id=g.user_id
 where g.user_id=any(p_users) and not coalesce(u.is_anonymous,false) and p.deleted_at is null and (g.expires_at is null or g.expires_at>now());
 return result;
end; $$;
create function public.studylab_plus_profile_state(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; prefs public.studylab_plus_appearance%rowtype;
begin
 result:=coalesce(public.studylab_plus_public_styles(array[p_user])->p_user::text,'{"active":false}'::jsonb);
 if auth.uid()=p_user and coalesce((result->>'active')::boolean,false) then
  select * into prefs from public.studylab_plus_appearance where user_id=p_user;
  result:=result||jsonb_build_object('pet',coalesce(prefs.pet,'default'),'timer',coalesce(prefs.timer,'standard'),'details',coalesce(prefs.details,'{"shape":"default","eyes":"default","glow":"default","mouth":"default","eyeColor":"default","timerAccent":"default"}'::jsonb));
 end if;
 return result;
end; $$;
create function public.studylab_plus_save_appearance(p_cover text,p_frame text,p_effect text,p_bubble text,p_pet text,p_timer text,p_details jsonb,p_pattern text,p_card_pattern text,p_card_glow text,p_chat_font text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null or not coalesce((public.studylab_plus_status()->>'active')::boolean,false) then raise exception 'Active Plus required' using errcode='42501'; end if;
 insert into public.studylab_plus_appearance(user_id,cover,frame,effect,bubble,pet,timer,details,pattern,card_pattern,card_glow,chat_font) values(uid,p_cover,p_frame,p_effect,p_bubble,p_pet,p_timer,p_details,p_pattern,p_card_pattern,p_card_glow,p_chat_font)
 on conflict(user_id) do update set cover=excluded.cover,frame=excluded.frame,effect=excluded.effect,bubble=excluded.bubble,pet=excluded.pet,timer=excluded.timer,details=excluded.details,pattern=excluded.pattern,card_pattern=excluded.card_pattern,card_glow=excluded.card_glow,chat_font=excluded.chat_font;
 return public.studylab_plus_profile_state(uid);
end; $$;
revoke all on function public.studylab_plus_public_styles(uuid[]),public.studylab_plus_profile_state(uuid),public.studylab_plus_save_appearance(text,text,text,text,text,text,jsonb,text,text,text,text) from public,anon,authenticated;
grant execute on function public.studylab_plus_public_styles(uuid[]),public.studylab_plus_profile_state(uuid),public.studylab_plus_save_appearance(text,text,text,text,text,text,jsonb,text,text,text,text) to authenticated;
commit;
