-- Guardian live text gate. Defaults OFF for compatible deployment. No historical content changed.
create table if not exists studylab_private.guardian_settings (
  singleton boolean primary key default true check(singleton),
  settings jsonb not null default '{"enabled":false,"chat":true,"posts":true,"comments":true,"links":true,"spam":true,"ai":false}'::jsonb
);
alter table studylab_private.guardian_settings enable row level security;
revoke all on studylab_private.guardian_settings from public, anon, authenticated;
insert into studylab_private.guardian_settings(singleton) values(true) on conflict do nothing;

create or replace function public.studylab_guardian_settings(p_settings jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or not exists(select 1 from auth.users u where u.id=(select auth.uid()) and u.raw_app_meta_data->>'role'='admin') then
    raise exception 'Administrator access required' using errcode='42501';
  end if;
  if p_settings is not null then
    if jsonb_typeof(p_settings) <> 'object' then raise exception 'Invalid settings'; end if;
    if not (p_settings ?& array['enabled','chat','posts','comments','links','spam','ai']) or
      exists(select 1 from jsonb_each(p_settings) x where x.key not in ('enabled','chat','posts','comments','links','spam','ai') or jsonb_typeof(x.value)<>'boolean')
    then raise exception 'Invalid settings'; end if;
    update studylab_private.guardian_settings set settings=p_settings where singleton;
  end if;
  select settings into result from studylab_private.guardian_settings where singleton;
  return result;
end $$;
revoke all on function public.studylab_guardian_settings(jsonb) from public, anon, authenticated;
grant execute on function public.studylab_guardian_settings(jsonb) to authenticated;

create table if not exists studylab_private.guardian_permits (
  actor uuid not null, surface text not null, fingerprint bytea not null, expires_at timestamptz not null,
  primary key(actor,surface,fingerprint)
);
create index if not exists guardian_permit_expiry_idx on studylab_private.guardian_permits(expires_at);
alter table studylab_private.guardian_permits enable row level security;
revoke all on studylab_private.guardian_permits from public,anon,authenticated;
create table if not exists studylab_private.guardian_quota (
  actor uuid not null, bucket timestamptz not null, attempts integer not null default 1,
  primary key(actor,bucket)
);
alter table studylab_private.guardian_quota enable row level security;
revoke all on studylab_private.guardian_quota from public,anon,authenticated;
create index if not exists guardian_quota_bucket_idx on studylab_private.guardian_quota(bucket);
create table if not exists studylab_private.guardian_events (
  id bigint generated always as identity primary key, created_at timestamptz not null default now(),
  surface text not null, outcome text not null, reason text not null
);
alter table studylab_private.guardian_events enable row level security;
revoke all on studylab_private.guardian_events from public,anon,authenticated;
create index if not exists guardian_event_time_idx on studylab_private.guardian_events(created_at);
create or replace function public.studylab_guardian_mode(p_surface text)
returns boolean language sql stable security definer set search_path='' as $
 select (select auth.uid()) is not null and exists(
 select 1 from studylab_private.guardian_settings
 where singleton and settings->>'enabled'='true' and settings->>'ai'='true'
 and p_surface in ('chat','posts','comments') and settings->>p_surface='true')
$;
revoke all on function public.studylab_guardian_mode(text) from public,anon,authenticated;
grant execute on function public.studylab_guardian_mode(text) to authenticated;

create or replace function public.studylab_guardian_begin(p_actor uuid,p_surface text)
returns text language plpgsql security definer set search_path='' as $
declare n integer; cfg jsonb;
begin
 if p_actor is null or p_surface not in ('chat','posts','comments') then raise exception 'Invalid moderation request'; end if;
 select settings into cfg from studylab_private.guardian_settings where singleton;
 if not (cfg->>'enabled'='true' and cfg->>'ai'='true' and cfg->>p_surface='true') then return 'off'; end if;
 delete from studylab_private.guardian_quota where bucket<now()-interval '2 hours';
 insert into studylab_private.guardian_quota(actor,bucket) values(p_actor,date_trunc('minute',now()))
 on conflict(actor,bucket) do update set attempts=guardian_quota.attempts+1 returning attempts into n;
 if n>25 then return 'rate'; end if;
 return 'check';
end $;
revoke all on function public.studylab_guardian_begin(uuid,text) from public,anon,authenticated;
grant execute on function public.studylab_guardian_begin(uuid,text) to service_role;

create or replace function public.studylab_guardian_complete(p_actor uuid,p_surface text,p_body text,p_allowed boolean)
returns void language plpgsql security definer set search_path='' as $
begin
 if p_actor is null or p_surface not in ('chat','posts','comments') or p_body is null or length(p_body)>15000 or p_allowed is null then raise exception 'Invalid moderation result'; end if;
 delete from studylab_private.guardian_permits where expires_at<now();
 delete from studylab_private.guardian_events where created_at<now()-interval '30 days';
 if p_allowed then
   insert into studylab_private.guardian_permits(actor,surface,fingerprint,expires_at)
   values(p_actor,p_surface,sha256(convert_to(btrim(p_body),'UTF8')),now()+interval '3 minutes')
   on conflict(actor,surface,fingerprint) do update set expires_at=excluded.expires_at;
 else
   insert into studylab_private.guardian_events(surface,outcome,reason) values(p_surface,'blocked','AI flagged public text');
 end if;
end $;
revoke all on function public.studylab_guardian_complete(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.studylab_guardian_complete(uuid,text,text,boolean) to service_role;

create or replace function public.studylab_guardian_history()
returns jsonb language plpgsql security definer set search_path='' as $
declare result jsonb;
begin
 if (select auth.uid()) is null or not exists(select 1 from auth.users u where u.id=(select auth.uid()) and u.raw_app_meta_data->>'role'='admin') then
   raise exception 'Administrator access required' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc),'[]'::jsonb) into result
 from (select created_at,surface,outcome,reason from studylab_private.guardian_events where created_at>=now()-interval '30 days' order by created_at desc limit 50) e;
 return result;
end $;
revoke all on function public.studylab_guardian_history() from public,anon,authenticated;
grant execute on function public.studylab_guardian_history() to authenticated;

create or replace function studylab_private.guardian_check()
returns trigger language plpgsql security definer set search_path='' as $$
declare cfg jsonb; surface text; body text; actor uuid; recent integer; threshold integer;
begin
  select settings into cfg from studylab_private.guardian_settings where singleton;
  if not coalesce((cfg->>'enabled')::boolean,false) then return new; end if;
  case tg_table_name
    when 'studylab_chat_messages' then surface:='chat'; body:=new.message; actor:=new.user_id; threshold:=12;
    when 'studylab_social_posts' then surface:='posts'; body:=new.body; actor:=new.author_id; threshold:=4;
    when 'studylab_social_comments' then surface:='comments'; body:=new.body; actor:=new.author_id; threshold:=8;
    else raise exception 'Unknown Guardian surface';
  end case;
  if not coalesce((cfg->>surface)::boolean,false) then return new; end if;
  if coalesce((cfg->>'links')::boolean,false) and (
    coalesce(body,'') ~* '(javascript|vbscript|data):[[:space:]]*([a-z]|<)' or
    coalesce(body,'') ~* 'https?://[^[:space:]/?#]+@[^[:space:]/?#]+'
  ) then raise exception 'Guardian: suspicious link structure. Please edit your message.' using errcode='23514'; end if;
  if tg_op='INSERT' and actor is not null and coalesce((cfg->>'spam')::boolean,false) then
    perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||surface,0));
    case surface
      when 'chat' then select count(*) into recent from public.studylab_chat_messages where user_id=actor and created_at>=now()-interval '1 minute';
      when 'posts' then select count(*) into recent from public.studylab_social_posts where author_id=actor and created_at>=now()-interval '1 minute';
      when 'comments' then select count(*) into recent from public.studylab_social_comments where author_id=actor and created_at>=now()-interval '1 minute';
    end case;
    if recent>=threshold then raise exception 'Guardian: too many recent submissions. Please try again shortly.' using errcode='23514'; end if;
  end if;
  if cfg->>'ai'='true' then
    if tg_op='UPDATE' then
      if surface='chat' then
        if new.message is not distinct from old.message then return new; end if;
      else
        if new.body is not distinct from old.body then return new; end if;
      end if;
    end if;
    if actor is null then raise exception 'Guardian: sign in before publishing.' using errcode='23514'; end if;
    delete from studylab_private.guardian_permits
    where guardian_permits.actor=guardian_check.actor and guardian_permits.surface=guardian_check.surface
    and fingerprint=sha256(convert_to(btrim(coalesce(body,'')),'UTF8')) and expires_at>now();
    if not found then raise exception 'Guardian: moderation approval required. Refresh StudyLab and try again.' using errcode='23514'; end if;
  end if;
  return new;
end $;
revoke all on function studylab_private.guardian_check() from public, anon, authenticated;
create index if not exists guardian_chat_actor_time_idx on public.studylab_chat_messages(user_id,created_at desc);
create index if not exists guardian_posts_actor_time_idx on public.studylab_social_posts(author_id,created_at desc);
create index if not exists guardian_comments_actor_time_idx on public.studylab_social_comments(author_id,created_at desc);
create trigger guardian_chat_check before insert or update of message on public.studylab_chat_messages for each row execute function studylab_private.guardian_check();
create trigger guardian_posts_check before insert or update of body on public.studylab_social_posts for each row execute function studylab_private.guardian_check();
create trigger guardian_comments_check before insert or update of body on public.studylab_social_comments for each row execute function studylab_private.guardian_check();
