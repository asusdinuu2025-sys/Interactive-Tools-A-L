-- Staged only: do not apply to production until isolated preview tests pass.
-- Deterministic rules only. Default OFF; no historical content is touched.
create table if not exists studylab_private.guardian_settings (
  singleton boolean primary key default true check(singleton),
  settings jsonb not null default '{"enabled":false,"chat":true,"posts":true,"comments":true,"links":true,"spam":true}'::jsonb
);
alter table studylab_private.guardian_settings enable row level security;
revoke all on studylab_private.guardian_settings from public, anon, authenticated;
insert into studylab_private.guardian_settings(singleton) values(true) on conflict do nothing;

create or replace function public.studylab_guardian_settings(p_settings jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or not (select public.studylab_social_is_admin()) then
    raise exception 'Administrator access required' using errcode='42501';
  end if;
  if p_settings is not null then
    if jsonb_typeof(p_settings) <> 'object' then raise exception 'Invalid settings'; end if;
    if not (p_settings ?& array['enabled','chat','posts','comments','links','spam']) or
      exists(select 1 from jsonb_each(p_settings) x where x.key not in ('enabled','chat','posts','comments','links','spam') or jsonb_typeof(x.value)<>'boolean')
    then raise exception 'Invalid settings'; end if;
    update studylab_private.guardian_settings set settings=p_settings where singleton;
  end if;
  select settings into result from studylab_private.guardian_settings where singleton;
  return result;
end $$;
revoke all on function public.studylab_guardian_settings(jsonb) from public, anon, authenticated;
grant execute on function public.studylab_guardian_settings(jsonb) to authenticated;

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
  return new;
end $$;
revoke all on function studylab_private.guardian_check() from public, anon, authenticated;
create index if not exists guardian_chat_actor_time_idx on public.studylab_chat_messages(user_id,created_at desc);
create index if not exists guardian_posts_actor_time_idx on public.studylab_social_posts(author_id,created_at desc);
create index if not exists guardian_comments_actor_time_idx on public.studylab_social_comments(author_id,created_at desc);
create trigger guardian_chat_check before insert or update of message on public.studylab_chat_messages for each row execute function studylab_private.guardian_check();
create trigger guardian_posts_check before insert or update of body on public.studylab_social_posts for each row execute function studylab_private.guardian_check();
create trigger guardian_comments_check before insert or update of body on public.studylab_social_comments for each row execute function studylab_private.guardian_check();
