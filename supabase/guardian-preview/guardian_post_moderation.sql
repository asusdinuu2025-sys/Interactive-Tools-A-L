-- STAGED: install only in an isolated database with the worker and scheduler.
-- No change to the existing mode, and no activation by this migration.
begin;
create table if not exists studylab_private.guardian_post_worker_state(
 singleton boolean primary key default true check(singleton),
 last_ok timestamptz, ready boolean not null default false
);
insert into studylab_private.guardian_post_worker_state(singleton) values(true) on conflict do nothing;
alter table studylab_private.guardian_post_worker_state enable row level security;
revoke all on studylab_private.guardian_post_worker_state from public,anon,authenticated;
create table if not exists studylab_private.guardian_post_jobs(
 message_id uuid primary key references public.studylab_chat_messages(id) on delete cascade deferrable initially deferred,
 actor uuid not null, fingerprint bytea not null,
 expires_at timestamptz not null, lease uuid, lease_until timestamptz
);
alter table studylab_private.guardian_post_jobs enable row level security;
revoke all on studylab_private.guardian_post_jobs from public,anon,authenticated;
create index if not exists guardian_post_job_expiry on studylab_private.guardian_post_jobs(expires_at);
create index if not exists guardian_post_job_actor on studylab_private.guardian_post_jobs(actor);
alter table studylab_private.guardian_chat_preferences drop constraint if exists guardian_chat_preferences_mode_check;
alter table studylab_private.guardian_chat_preferences add constraint guardian_chat_preferences_mode_check check(mode in ('instant','strict','public'));
create or replace function studylab_private.guardian_post_ready()
returns boolean language sql stable security definer set search_path='' as $post$
 select exists(select 1 from studylab_private.guardian_post_worker_state where singleton and ready and last_ok>clock_timestamp()-interval '20 seconds')
 and exists(select 1 from studylab_private.guardian_settings where singleton and settings->>'enabled'='true' and settings->>'chat'='true' and settings->>'ai'='true' and settings->>'links'='true' and settings->>'spam'='true')
 and exists(select 1 from studylab_private.guardian_word_settings where singleton and enabled and cardinality(words)>0)
$post$;
revoke all on function studylab_private.guardian_post_ready() from public,anon,authenticated;
create or replace function public.studylab_guardian_chat_mode()
returns text language sql stable security definer set search_path='' as $post$
 select case when mode='public' and not studylab_private.guardian_post_ready() then 'instant' else mode end
 from studylab_private.guardian_chat_preferences where singleton and (select auth.uid()) is not null
$post$;
revoke all on function public.studylab_guardian_chat_mode() from public,anon,authenticated;
grant execute on function public.studylab_guardian_chat_mode() to authenticated;
create or replace function public.studylab_guardian_set_chat_mode(p_mode text)
returns text language plpgsql security definer set search_path='' as $post$
begin
 if (select auth.uid()) is null or not exists(select 1 from auth.users where id=(select auth.uid()) and raw_app_meta_data->>'role'='admin') then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_mode is null or p_mode not in ('instant','strict','public') then raise exception 'Invalid chat mode'; end if;
 if p_mode='public' and not studylab_private.guardian_post_ready() then raise exception 'Instant Public unavailable: moderation worker and required rule modules must be ready.'; end if;
 update studylab_private.guardian_chat_preferences set mode=p_mode where singleton;
 return p_mode;
end $post$;
revoke all on function public.studylab_guardian_set_chat_mode(text) from public,anon,authenticated;
grant execute on function public.studylab_guardian_set_chat_mode(text) to authenticated;
-- This function is called only AFTER the existing word, URL and flood checks.
-- Restrict the experimental path to short text, excluding links, contacts and media.
create or replace function studylab_private.guardian_post_enqueue(p_id uuid,p_actor uuid,p_text text)
returns boolean language plpgsql security definer set search_path='' as $post$
begin
 if p_id is null or p_actor is null or p_actor is distinct from (select auth.uid()) or p_text is null or length(btrim(p_text)) not between 1 and 160 then return false; end if;
 if p_text ~* '(https?[:/]|www[.]|[@/\\]|[0-9]{3,}|[[:cntrl:]])' then return false; end if;
 if not exists(select 1 from studylab_private.guardian_chat_preferences where singleton and mode='public') or not studylab_private.guardian_post_ready() then return false; end if;
 -- Global serialization only for the experimental lane; bounded exposure and backlog.
 perform pg_advisory_xact_lock(hashtextextended('studylab:guardian:post-lane',0));
 if not studylab_private.guardian_post_ready() or (select count(*) from studylab_private.guardian_post_jobs)>=8 or exists(select 1 from studylab_private.guardian_post_jobs where actor=p_actor) then return false; end if;
 insert into studylab_private.guardian_post_jobs(message_id,actor,fingerprint,expires_at)
 values(p_id,p_actor,sha256(convert_to(btrim(p_text),'UTF8')),clock_timestamp()+interval '12 seconds');
 return true;
end $post$;
revoke all on function studylab_private.guardian_post_enqueue(uuid,uuid,text) from public,anon,authenticated;
-- Worker claims only committed current rows and cannot accept caller-supplied text.
create or replace function public.studylab_guardian_post_claim()
returns jsonb language plpgsql security definer set search_path='' as $post$
declare output jsonb;
begin
 with selected as (
  select j.message_id from studylab_private.guardian_post_jobs j
  join public.studylab_chat_messages m on m.id=j.message_id
  where j.expires_at>clock_timestamp() and (j.lease_until is null or j.lease_until<clock_timestamp())
  and j.fingerprint=sha256(convert_to(btrim(m.message),'UTF8'))
  order by j.expires_at limit 8 for update of j skip locked
 ), leased as (
  update studylab_private.guardian_post_jobs j set lease=gen_random_uuid(),lease_until=clock_timestamp()+interval '8 seconds'
  from selected s where j.message_id=s.message_id returning j.message_id,j.lease
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',l.message_id,'lease',l.lease,'text',m.message)),'[]'::jsonb) into output
 from leased l join public.studylab_chat_messages m on m.id=l.message_id;
 return output;
end $post$;
revoke all on function public.studylab_guardian_post_claim() from public,anon,authenticated;
grant execute on function public.studylab_guardian_post_claim() to service_role;
create or replace function public.studylab_guardian_post_health(p_ok boolean)
returns void language sql security definer set search_path='' as $post$
 update studylab_private.guardian_post_worker_state set ready=coalesce(p_ok,false),last_ok=case when p_ok then clock_timestamp() else last_ok end where singleton
$post$;
revoke all on function public.studylab_guardian_post_health(boolean) from public,anon,authenticated;
grant execute on function public.studylab_guardian_post_health(boolean) to service_role;
create or replace function public.studylab_guardian_post_finish(p_id uuid,p_lease uuid,p_allowed boolean)
returns void language plpgsql security definer set search_path='' as $post$
declare job studylab_private.guardian_post_jobs%rowtype;
begin
 select * into job from studylab_private.guardian_post_jobs where message_id=p_id and lease=p_lease;
 if not found or p_allowed is null then return; end if;
 -- Lock message first, consistent with edits and ordinary deletes.
 perform 1 from public.studylab_chat_messages where id=p_id for update;
 select * into job from studylab_private.guardian_post_jobs where message_id=p_id and lease=p_lease for update;
 if not found then return; end if;
 if not p_allowed or job.expires_at<=clock_timestamp() then
  delete from public.studylab_chat_messages where id=p_id and sha256(convert_to(btrim(message),'UTF8'))=job.fingerprint;
  if found then insert into studylab_private.guardian_events(surface,outcome,reason) values('chat','blocked',case when p_allowed then 'Post-check expired' else 'AI flagged public text' end); end if;
 end if;
 delete from studylab_private.guardian_post_jobs where message_id=p_id and lease=p_lease;
end $post$;
revoke all on function public.studylab_guardian_post_finish(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.studylab_guardian_post_finish(uuid,uuid,boolean) to service_role;
-- Independent database watchdog removes unverified expired content even if the
-- Edge Function fails, and never deletes an approved edit with a new fingerprint.
create or replace function studylab_private.guardian_post_expire()
returns void language plpgsql security definer set search_path='' as $post$
declare j record;
begin
 for j in select message_id from studylab_private.guardian_post_jobs where expires_at<=clock_timestamp() order by expires_at limit 20 loop
  perform 1 from public.studylab_chat_messages where id=j.message_id for update;
  if exists(select 1 from studylab_private.guardian_post_jobs q where q.message_id=j.message_id and q.expires_at<=clock_timestamp()) then
   delete from public.studylab_chat_messages m using studylab_private.guardian_post_jobs q
   where m.id=j.message_id and q.message_id=m.id and q.expires_at<=clock_timestamp() and q.fingerprint=sha256(convert_to(btrim(m.message),'UTF8'));
   if found then insert into studylab_private.guardian_events(surface,outcome,reason) values('chat','blocked','Post-check expired'); end if;
   delete from studylab_private.guardian_post_jobs where message_id=j.message_id and expires_at<=clock_timestamp();
  end if;
 end loop;
end $post$;
revoke all on function studylab_private.guardian_post_expire() from public,anon,authenticated;
create or replace function studylab_private.guardian_check()
returns trigger language plpgsql security definer set search_path='' as $$
<<gate>>
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
    where guardian_permits.actor=gate.actor and guardian_permits.surface=gate.surface
    and fingerprint=sha256(convert_to(btrim(coalesce(body,'')),'UTF8')) and expires_at>now();
    if not found then
      if surface='chat' and tg_op='INSERT' and tg_table_schema='public' then
        if coalesce(cardinality(new.image_paths),0)=0 and coalesce(new.file_attachments,'[]'::jsonb)='[]'::jsonb then
          if studylab_private.guardian_post_enqueue(new.id,actor,body) then return new; end if;
        end if;
      end if;
      raise exception 'Guardian: moderation approval required. Refresh StudyLab and try again.' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
revoke all on function studylab_private.guardian_check() from public, anon, authenticated;

commit;
