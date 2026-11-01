-- Admin moderation controls for StudyLab Social.
create or replace function public.studylab_social_is_admin()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;
revoke all on function public.studylab_social_is_admin() from public, anon;
grant execute on function public.studylab_social_is_admin() to authenticated;

drop policy if exists "Social posts visible when approved or owned" on public.studylab_social_posts;
create policy "Social posts visible when approved owned or admin"
on public.studylab_social_posts for select to authenticated
using (status = 'approved' or author_id = (select auth.uid()) or (select public.studylab_social_is_admin()));

drop policy if exists "Approved social comments or own comments are visible" on public.studylab_social_comments;
create policy "Social comments visible when approved owned or admin"
on public.studylab_social_comments for select to authenticated
using (status = 'approved' or author_id = (select auth.uid()) or (select public.studylab_social_is_admin()));

drop policy if exists "Social images visible when approved or owned" on public.studylab_social_post_images;
create policy "Social images visible when approved owned or admin"
on public.studylab_social_post_images for select to authenticated
using (author_id = (select auth.uid()) or (select public.studylab_social_is_admin()) or exists (
  select 1 from public.studylab_social_posts p where p.id = post_id and p.status = 'approved'
));

drop policy if exists "Social images readable by owner or approved feed viewers" on storage.objects;
create policy "Social images readable by owner approved viewers or admin"
on storage.objects for select to authenticated
using (bucket_id = 'studylab-social' and (
  (storage.foldername(name))[1] = (select auth.uid())::text
  or (select public.studylab_social_is_admin())
  or exists (
    select 1 from public.studylab_social_post_images i
    join public.studylab_social_posts p on p.id = i.post_id
    where i.bucket_path = name and p.status = 'approved'
  )
));

create or replace function public.studylab_social_moderate_post(p_post_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.studylab_social_is_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('approved','rejected','removed') then raise exception 'Invalid moderation status'; end if;
  update public.studylab_social_posts set status = p_status where id = p_post_id;
  return found;
end; $$;
create or replace function public.studylab_social_moderate_comment(p_comment_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.studylab_social_is_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('approved','rejected','removed') then raise exception 'Invalid moderation status'; end if;
  update public.studylab_social_comments set status = p_status where id = p_comment_id;
  return found;
end; $$;
revoke all on function public.studylab_social_moderate_post(uuid,text) from public, anon;
revoke all on function public.studylab_social_moderate_comment(uuid,text) from public, anon;
grant execute on function public.studylab_social_moderate_post(uuid,text) to authenticated;
grant execute on function public.studylab_social_moderate_comment(uuid,text) to authenticated;

create or replace function public.studylab_social_delete_own_pending_post(p_post_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.studylab_social_posts
  where id = p_post_id and author_id = auth.uid() and status = 'pending';
  return found;
end; $$;
revoke all on function public.studylab_social_delete_own_pending_post(uuid) from public, anon;
grant execute on function public.studylab_social_delete_own_pending_post(uuid) to authenticated;
