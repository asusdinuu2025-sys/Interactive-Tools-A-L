-- Install only after guardian_post_moderation.sql has passed regression tests.
-- A single-use dispatch ticket is not a standing secret. Only the service
-- worker may redeem it. No user content, API key or service key is in pg_net.
begin;
alter table studylab_private.guardian_post_worker_state
 add column if not exists last_requested timestamptz,
 add column if not exists ticket_hash bytea,
 add column if not exists ticket_expires timestamptz;

create or replace function studylab_private.guardian_post_rules_ready()
returns boolean language sql stable security definer set search_path='' as $post$
 select exists(select 1 from studylab_private.guardian_settings where singleton and settings->>'enabled'='true' and settings->>'chat'='true' and settings->>'ai'='true' and settings->>'links'='true' and settings->>'spam'='true')
 and exists(select 1 from studylab_private.guardian_word_settings where singleton and enabled and cardinality(words)>0)
$post$;
revoke all on function studylab_private.guardian_post_rules_ready() from public,anon,authenticated;

create or replace function studylab_private.guardian_post_ready()
returns boolean language sql stable security definer set search_path='' as $post$
 select studylab_private.guardian_post_rules_ready() and exists(
 select 1 from studylab_private.guardian_post_worker_state
 where singleton and ready and last_ok>clock_timestamp()-interval '90 seconds'
 and last_watchdog>clock_timestamp()-interval '9 seconds')
$post$;
revoke all on function studylab_private.guardian_post_ready() from public,anon,authenticated;

create or replace function public.studylab_guardian_post_authorize(p_token text)
returns boolean language plpgsql security definer set search_path='' as $post$
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return false; end if;
 update studylab_private.guardian_post_worker_state set ticket_hash=null,ticket_expires=null
 where singleton and ticket_expires>clock_timestamp() and ticket_hash=sha256(convert_to(p_token,'UTF8'));
 return found;
end $post$;
revoke all on function public.studylab_guardian_post_authorize(text) from public,anon,authenticated;
grant execute on function public.studylab_guardian_post_authorize(text) to service_role;

-- Dispatch is serialized through the singleton. No HTTP requests while idle.
-- At most one synthetic health probe per minute in requested public mode,
-- plus work for queued messages. The watchdog is independent of the worker.
create or replace function studylab_private.guardian_post_dispatch()
returns bigint language plpgsql security definer set search_path='' as $post$
declare st studylab_private.guardian_post_worker_state%rowtype; token text; rid bigint; has_jobs boolean;
begin
 select * into st from studylab_private.guardian_post_worker_state where singleton for update;
 if not found then return null; end if;
 if st.last_requested>clock_timestamp()-interval '3 seconds' then return null; end if;
 if st.ticket_expires>clock_timestamp() then return null; end if;
 select exists(select 1 from studylab_private.guardian_post_jobs where expires_at>clock_timestamp() and (lease_until is null or lease_until<clock_timestamp())) into has_jobs;
 if not has_jobs then
  if not exists(select 1 from studylab_private.guardian_chat_preferences where singleton and mode='public') then return null; end if;
  if not studylab_private.guardian_post_rules_ready() then return null; end if;
  if st.last_requested>clock_timestamp()-interval '60 seconds' then return null; end if;
 end if;
 token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 update studylab_private.guardian_post_worker_state set last_requested=clock_timestamp(),ticket_hash=sha256(convert_to(token,'UTF8')),ticket_expires=clock_timestamp()+interval '10 seconds' where singleton;
 select net.http_post(url:='https://zpvatyxdbshjuqgtexzw.supabase.co/functions/v1/studylab-guardian-post-worker',headers:=jsonb_build_object('Content-Type','application/json','x-guardian-worker',token),body:='{}'::jsonb,timeout_milliseconds:=9000) into rid;
 return rid;
end $post$;
revoke all on function studylab_private.guardian_post_dispatch() from public,anon,authenticated;

create or replace function public.studylab_guardian_set_chat_mode(p_mode text)
returns text language plpgsql security definer set search_path='' as $post$
begin
 if (select auth.uid()) is null or not exists(select 1 from auth.users where id=(select auth.uid()) and raw_app_meta_data->>'role'='admin') then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_mode is null or p_mode not in ('instant','strict','public') then raise exception 'Invalid chat mode'; end if;
 if p_mode='public' and not studylab_private.guardian_post_rules_ready() then raise exception 'Instant Public requires Guardian, AI, link, flood and custom word filtering to be enabled.'; end if;
 update studylab_private.guardian_chat_preferences set mode=p_mode where singleton;
 -- Requested and effective modes are separate. While the worker starts,
 -- the database gate still requires the normal one-use AI approval.
 return p_mode;
end $post$;
revoke all on function public.studylab_guardian_set_chat_mode(text) from public,anon,authenticated;
grant execute on function public.studylab_guardian_set_chat_mode(text) to authenticated;
create or replace function public.studylab_guardian_post_status()
returns jsonb language plpgsql stable security definer set search_path='' as $post$
declare requested text;
begin
 if (select auth.uid()) is null or not exists(select 1 from auth.users where id=(select auth.uid()) and raw_app_meta_data->>'role'='admin') then raise exception 'Administrator access required' using errcode='42501'; end if;
 select mode into requested from studylab_private.guardian_chat_preferences where singleton;
 return jsonb_build_object('requested',requested,'effective',case when requested='public' and not studylab_private.guardian_post_ready() then 'instant' else requested end,'ready',studylab_private.guardian_post_ready());
end $post$;
revoke all on function public.studylab_guardian_post_status() from public,anon,authenticated;
grant execute on function public.studylab_guardian_post_status() to authenticated;
commit;
