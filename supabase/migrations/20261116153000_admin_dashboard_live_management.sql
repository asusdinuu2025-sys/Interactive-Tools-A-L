-- StudyLab Admin Dashboard schema. Tested with PGlite before deployment.
-- PR #102 only; data writes are explicitly initiated by authorized admins.
-- Never grants new admin privileges just by loading this migration.
begin;
create schema if not exists studylab_private;
-- Preserve existing private-schema grants used by StudyLab chat/moderation.
-- New admin tables remain RLS-protected and have no direct public grants.
create table studylab_private.admins(user_id uuid primary key references auth.users(id) on delete cascade, granted_by uuid, created_at timestamptz not null default now());
alter table studylab_private.admins enable row level security;
insert into studylab_private.admins(user_id)
select id from auth.users where id in ('24e78cd0-4565-407a-96f7-9cfde083f6d2','7c97a8d7-f047-4c88-883d-4bed9b1a5f99','b6c80613-8217-48ac-851b-a39a3d9bef2b') and coalesce(is_anonymous,false)=false and raw_app_meta_data->>'role'='admin';
-- Fresh database membership replaces hardcoded IDs and stale JWT role claims.
create or replace function public.studylab_social_is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from studylab_private.admins a join auth.users u on u.id=a.user_id where a.user_id=auth.uid() and coalesce(u.is_anonymous,false)=false);
$$;
-- Existing public policies on social posts/announcements call this function even
-- for anonymous reads. Preserve permission to CALL; anonymous returns false.
revoke all on function public.studylab_social_is_admin() from public;
grant execute on function public.studylab_social_is_admin() to anon,authenticated;

create table public.studylab_verifications(user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now());
alter table public.studylab_verifications enable row level security;
revoke all on public.studylab_verifications from anon,authenticated;
grant select on public.studylab_verifications to anon,authenticated;
create policy "Public badge lookup" on public.studylab_verifications for select to anon,authenticated using(true);
insert into public.studylab_verifications(user_id) select id from auth.users where id in ('24e78cd0-4565-407a-96f7-9cfde083f6d2','7c97a8d7-f047-4c88-883d-4bed9b1a5f99','b6c80613-8217-48ac-851b-a39a3d9bef2b','1f01a0f7-2030-4e14-b561-1e17648d4b3f');
create table studylab_private.activity(id bigint generated always as identity primary key, actor uuid not null, action text not null, target text not null, created_at timestamptz not null default now());
alter table studylab_private.activity enable row level security;
create index on studylab_private.activity(created_at desc);
create table studylab_private.content(id text primary key, draft jsonb not null, revision integer not null default 1, published boolean not null default false);
alter table studylab_private.content enable row level security;
create table public.studylab_site_content(id text primary key, page text not null, payload jsonb not null);
alter table public.studylab_site_content enable row level security;
create index on public.studylab_site_content(page);
revoke all on public.studylab_site_content from anon,authenticated;
grant select on public.studylab_site_content to anon,authenticated;
create policy "Published content readable" on public.studylab_site_content for select to anon,authenticated using(true);

create function public.studylab_admin_users(p_query text default '',p_page integer default 0,p_admins boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; total bigint;
begin
 if not public.studylab_social_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_page<0 or p_page>100000 or length(p_query)>100 then raise exception 'Invalid search'; end if;
 select count(*) into total from public.studylab_profiles p join auth.users u on u.id=p.id where (not p_admins or exists(select 1 from studylab_private.admins a where a.user_id=p.id)) and (coalesce(p.display_name,'')||' '||coalesce(p.username,'')) ilike '%'||p_query||'%';
 select coalesce(jsonb_agg(t),'[]') into result from (
 select p.id,p.display_name,p.username,p.school,p.bio,p.created_at,coalesce(u.is_anonymous,false) as guest,
 exists(select 1 from studylab_private.admins a where a.user_id=p.id) as admin,
 exists(select 1 from public.studylab_verifications v where v.user_id=p.id) as verified
 from public.studylab_profiles p join auth.users u on u.id=p.id
 where (not p_admins or exists(select 1 from studylab_private.admins a where a.user_id=p.id)) and (coalesce(p.display_name,'')||' '||coalesce(p.username,'')) ilike '%'||p_query||'%'
 order by p.created_at desc,p.id limit 20 offset p_page*20) t;
 return jsonb_build_object('rows',result,'total',total);
end;$$;
create function public.studylab_admin_user_set(p_user uuid,p_field text,p_value boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 -- Serialize membership changes, including the authorization check, to prevent last-admin races.
 perform pg_advisory_xact_lock(187641206);
 if not public.studylab_social_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_value is null or p_field is null or p_field not in ('admin','verified') then raise exception 'Invalid action'; end if;
 if not exists(select 1 from auth.users where id=p_user and coalesce(is_anonymous,false)=false) then raise exception 'Choose a registered account'; end if;
 if p_field='admin' then
  if p_value then insert into studylab_private.admins(user_id,granted_by) values(p_user,auth.uid()) on conflict do nothing;
  else
   if p_user=auth.uid() then raise exception 'Ask another admin to remove your access'; end if;
   if (select count(*) from studylab_private.admins)<=1 then raise exception 'Keep at least one admin'; end if;
   delete from studylab_private.admins where user_id=p_user;
  end if;
 update auth.users set raw_app_meta_data=case when p_value then coalesce(raw_app_meta_data,'{}'::jsonb)||jsonb_build_object('role','admin') else coalesce(raw_app_meta_data,'{}'::jsonb)-'role' end where id=p_user;
 else
  if p_value then insert into public.studylab_verifications(user_id) values(p_user) on conflict do nothing;
  else delete from public.studylab_verifications where user_id=p_user; end if;
 end if;
 insert into studylab_private.activity(actor,action,target) values(auth.uid(),case when p_value then 'Grant ' else 'Remove ' end||p_field,p_user::text);
end;$$;
create function public.studylab_admin_content_list() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.studylab_social_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('has_draft',c.draft is distinct from p.payload) order by c.id) from studylab_private.content c left join public.studylab_site_content p on p.id=c.id),'[]');
end;$$;
create function public.studylab_admin_content_save(p_id text,p_payload jsonb,p_revision integer,p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare current_revision integer; result jsonb; v_url text;
begin
 if not public.studylab_social_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_id is null or p_id !~ '^[a-zA-Z0-9_-]{1,100}$' or p_action is null or p_action not in ('draft','publish','hide','restore') or p_revision is null or p_revision<0 then raise exception 'Invalid content action'; end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>12000 then raise exception 'Invalid content'; end if;
 if coalesce(p_payload->>'id','')<>p_id or coalesce(p_payload->>'kind','') not in ('card','section') or coalesce(length(btrim(p_payload->>'title')),0) not between 1 and 160 or length(coalesce(p_payload->>'description',''))>1500 then raise exception 'Invalid content fields'; end if;
 if coalesce(p_payload->>'page','') not in ('index.html','maths.html','physics.html','chemistry.html','biology.html','Telegram_Channels.html','lesson-packs.html') or coalesce(p_payload->>'order','') !~ '^[0-9]{1,5}$' or (p_payload->>'order')::int>10000 or coalesce(jsonb_typeof(p_payload->'hidden'),'')<>'boolean' then raise exception 'Invalid page or order'; end if;
 if p_payload->>'kind'='section' and p_payload->>'page'<>'index.html' then raise exception 'Sections belong on Home'; end if;
 if p_payload->>'kind'='card' and coalesce(p_payload->>'url','')='' then raise exception 'A destination is required'; end if;
 foreach v_url in array array[coalesce(p_payload->>'url',''),coalesce(p_payload->>'image','')] loop
  if v_url<>'' and (v_url ~ '[[:space:][:cntrl:]\\]' or v_url ~ '^//' or (v_url ~ ':' and v_url !~ '^https://[^/@]+(/|$)') or v_url ~ '^https://[^/]*@') then raise exception 'Use HTTPS or site-relative links'; end if;
 end loop;
 if p_payload->>'section' is not null and p_payload->>'section'<>'' and p_payload->>'section' !~ '^[a-zA-Z0-9_-]{1,100}$' then raise exception 'Invalid section'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id,0));
 select revision into current_revision from studylab_private.content where id=p_id for update;
 if coalesce(current_revision,0)<>p_revision then raise exception 'This item changed. Reload before saving.' using errcode='40001'; end if;
 if p_action in ('hide','restore') then p_payload=jsonb_set(p_payload,'{hidden}',to_jsonb(p_action='hide')); end if;
 insert into studylab_private.content(id,draft,revision,published) values(p_id,p_payload,p_revision+1,p_action<>'draft')
 on conflict(id) do update set draft=excluded.draft,revision=excluded.revision,published=studylab_private.content.published or excluded.published;
 if p_action<>'draft' then insert into public.studylab_site_content(id,page,payload) values(p_id,p_payload->>'page',p_payload)
 on conflict(id) do update set page=excluded.page,payload=excluded.payload; end if;
 insert into studylab_private.activity(actor,action,target) values(auth.uid(),p_action,p_payload->>'title');
 select to_jsonb(c) into result from studylab_private.content c where id=p_id;return result;
end;$$;
create function public.studylab_admin_activity() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.studylab_social_is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(t) from (select actor,action,target,created_at from studylab_private.activity order by id desc limit 100)t),'[]');
end;$$;
revoke all on function public.studylab_admin_users(text,integer,boolean),public.studylab_admin_user_set(uuid,text,boolean),public.studylab_admin_content_list(),public.studylab_admin_content_save(text,jsonb,integer,text),public.studylab_admin_activity() from public,anon;
grant execute on function public.studylab_admin_users(text,integer,boolean),public.studylab_admin_user_set(uuid,text,boolean),public.studylab_admin_content_list(),public.studylab_admin_content_save(text,jsonb,integer,text),public.studylab_admin_activity() to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('studylab-admin-media','studylab-admin-media',true,5242880,array['image/jpeg','image/png','image/webp','application/pdf']);
create policy "Admins list media" on storage.objects for select to authenticated using(bucket_id='studylab-admin-media' and (select public.studylab_social_is_admin()));
create policy "Admins upload media" on storage.objects for insert to authenticated with check(bucket_id='studylab-admin-media' and (select public.studylab_social_is_admin()) and name ~ '^uploads/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$');
create policy "Admins remove media" on storage.objects for delete to authenticated using(bucket_id='studylab-admin-media' and (select public.studylab_social_is_admin()));

-- Keep the previously installed read-only admin endpoints in sync with the
-- dynamic membership registry. A newly granted administrator must be visible
-- in all admin views immediately, not only the editor.
create or replace function public.studylab_admin_readonly_users_v1(
  p_query text default '', p_page integer default 0, p_admins boolean default false
) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select public.studylab_admin_users(p_query, p_page, p_admins);
$$;
create or replace function public.studylab_admin_readonly_stats_v1()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not coalesce(public.studylab_social_is_admin(), false) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'profiles', (select count(*) from public.studylab_profiles),
    'registered', (
      select count(*) from public.studylab_profiles p
        join auth.users u on u.id = p.id
      where coalesce(u.is_anonymous, false) = false
    ),
    'guests', (
      select count(*) from public.studylab_profiles p
        join auth.users u on u.id = p.id
      where coalesce(u.is_anonymous, false) = true
    ),
    'admins', (select count(*) from studylab_private.admins),
    'social_posts', (select count(*) from public.studylab_social_posts),
    'reports', (select count(*) from public.studylab_social_reports)
  );
end;
$$;
revoke all on function public.studylab_admin_readonly_users_v1(text,integer,boolean),
              public.studylab_admin_readonly_stats_v1() from public,anon;
grant execute on function public.studylab_admin_readonly_users_v1(text,integer,boolean),
              public.studylab_admin_readonly_stats_v1() to authenticated;
commit;
