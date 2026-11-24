-- Independent module; apply only after preview tests and owner approval.
begin;
create table if not exists studylab_private.guardian_word_settings (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false, words text[] not null default '{}',
 version integer not null default 0, check(cardinality(words)<=200)
);
alter table studylab_private.guardian_word_settings enable row level security;
revoke all on studylab_private.guardian_word_settings from public,anon,authenticated;
insert into studylab_private.guardian_word_settings(singleton) values(true) on conflict do nothing;
create or replace function studylab_private.guardian_word_normalize(p_text text)
returns text language sql immutable set search_path='' as $word$
 select btrim(regexp_replace(lower(normalize(coalesce(p_text,''), NFC) collate "C"), '[^a-z0-9඀-෿]+',' ','g'))
$word$;
revoke all on function studylab_private.guardian_word_normalize(text) from public,anon,authenticated;
create or replace function public.studylab_guardian_words(p_enabled boolean default null,p_words text[] default null,p_version integer default null)
returns jsonb language plpgsql security definer set search_path='' as $word$
declare raw text; term text; clean text[]:='{}'; result jsonb;
begin
 if (select auth.uid()) is null or not exists(select 1 from auth.users u where u.id=(select auth.uid()) and u.raw_app_meta_data->>'role'='admin') then
   raise exception 'Administrator access required' using errcode='42501';
 end if;
 if p_enabled is not null or p_words is not null or p_version is not null then
   if p_enabled is null or p_words is null or p_version is null or cardinality(p_words)>200 or coalesce(array_ndims(p_words),1)<>1 then raise exception 'Invalid custom-word settings'; end if;
   foreach raw in array p_words loop
     term:=studylab_private.guardian_word_normalize(raw);
     if raw is null or length(raw)>120 or length(term) not between 1 and 80 then raise exception 'Invalid custom-word entry'; end if;
     if not(term=any(clean)) then clean:=array_append(clean,term); end if;
   end loop;
   update studylab_private.guardian_word_settings set enabled=p_enabled,words=clean,version=version+1 where singleton and version=p_version;
   if not found then raise exception 'Word list changed in another session. Reload before saving.'; end if;
 end if;
 select jsonb_build_object('enabled',enabled,'words',words,'version',version) into result from studylab_private.guardian_word_settings where singleton;
 return result;
end $word$;
revoke all on function public.studylab_guardian_words(boolean,text[],integer) from public,anon,authenticated;
grant execute on function public.studylab_guardian_words(boolean,text[],integer) to authenticated;
create or replace function studylab_private.guardian_custom_word_check()
returns trigger language plpgsql security definer set search_path='' as $word$
declare surface text; message_body text; cfg jsonb; word_cfg studylab_private.guardian_word_settings%rowtype; clean_body text;
begin
 case tg_table_name
  when 'studylab_chat_messages' then surface:='chat';message_body:=new.message;
  when 'studylab_social_posts' then surface:='posts';message_body:=new.body;
  when 'studylab_social_comments' then surface:='comments';message_body:=new.body;
  else return new;
 end case;
 select settings into cfg from studylab_private.guardian_settings where singleton;
 if coalesce(cfg->>'enabled','false')<>'true' or coalesce(cfg->>surface,'false')<>'true' then return new; end if;
 select * into word_cfg from studylab_private.guardian_word_settings where singleton;
 if not coalesce(word_cfg.enabled,false) or coalesce(cardinality(word_cfg.words),0)=0 then return new; end if;
 clean_body:=' '||studylab_private.guardian_word_normalize(message_body)||' ';
 if exists(select 1 from unnest(word_cfg.words) as word(term) where strpos(clean_body,' '||word.term||' ')>0) then
   raise exception 'Guardian: this message matches a community word filter. Please revise it or contact a moderator.' using errcode='23514';
 end if;
 return new;
end $word$;
revoke all on function studylab_private.guardian_custom_word_check() from public,anon,authenticated;
drop trigger if exists guardian_00_words_chat on public.studylab_chat_messages;
drop trigger if exists guardian_00_words_posts on public.studylab_social_posts;
drop trigger if exists guardian_00_words_comments on public.studylab_social_comments;
create trigger guardian_00_words_chat before insert or update of message on public.studylab_chat_messages for each row execute function studylab_private.guardian_custom_word_check();
create trigger guardian_00_words_posts before insert or update of body on public.studylab_social_posts for each row execute function studylab_private.guardian_custom_word_check();
create trigger guardian_00_words_comments before insert or update of body on public.studylab_social_comments for each row execute function studylab_private.guardian_custom_word_check();
commit;
