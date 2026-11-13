-- Simple StudyLab Social notifications for post likes and comments.
-- Additive only: existing posts, likes, comments and moderation remain unchanged.

create table if not exists public.studylab_social_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.studylab_social_posts(id) on delete cascade,
  actor_display_name text not null,
  notification_type text not null check (notification_type in ('like', 'comment')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists studylab_social_notifications_recipient_created_idx
  on public.studylab_social_notifications (recipient_id, created_at desc);
create index if not exists studylab_social_notifications_unread_idx
  on public.studylab_social_notifications (recipient_id)
  where is_read = false;

alter table public.studylab_social_notifications enable row level security;
revoke all on public.studylab_social_notifications from anon, authenticated;
grant select on public.studylab_social_notifications to authenticated;
grant update (is_read) on public.studylab_social_notifications to authenticated;

create policy "Students read their own Social notifications"
on public.studylab_social_notifications for select to authenticated
using (recipient_id = (select auth.uid()));

create policy "Students mark their own Social notifications as read"
on public.studylab_social_notifications for update to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

create or replace function public.studylab_social_notify_post_like()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  post_owner uuid;
  actor_name text;
begin
  select p.author_id into post_owner
  from public.studylab_social_posts p
  where p.id = new.post_id and p.status = 'approved';

  if post_owner is null or post_owner = new.user_id then
    return new;
  end if;

  select coalesce(nullif(btrim(sp.display_name), ''), 'A student')
    into actor_name
  from public.studylab_profiles sp
  where sp.id = new.user_id;

  insert into public.studylab_social_notifications
    (recipient_id, actor_id, post_id, actor_display_name, notification_type)
  values
    (post_owner, new.user_id, new.post_id, coalesce(actor_name, 'A student'), 'like');

  return new;
end;
$$;

create or replace function public.studylab_social_notify_post_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  post_owner uuid;
begin
  if new.status <> 'approved' then
    return new;
  end if;

  select p.author_id into post_owner
  from public.studylab_social_posts p
  where p.id = new.post_id and p.status = 'approved';

  if post_owner is null or post_owner = new.author_id then
    return new;
  end if;

  insert into public.studylab_social_notifications
    (recipient_id, actor_id, post_id, actor_display_name, notification_type)
  values
    (post_owner, new.author_id, new.post_id,
     coalesce(nullif(btrim(new.author_display_name), ''), 'A student'), 'comment');

  return new;
end;
$$;

revoke all on function public.studylab_social_notify_post_like() from public, anon, authenticated;
revoke all on function public.studylab_social_notify_post_comment() from public, anon, authenticated;

drop trigger if exists studylab_social_notify_like on public.studylab_social_likes;
create trigger studylab_social_notify_like
after insert on public.studylab_social_likes
for each row execute function public.studylab_social_notify_post_like();

drop trigger if exists studylab_social_notify_comment on public.studylab_social_comments;
create trigger studylab_social_notify_comment
after insert on public.studylab_social_comments
for each row execute function public.studylab_social_notify_post_comment();

-- Realtime powers the unread badge without requiring a page refresh.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'studylab_social_notifications'
     ) then
    alter publication supabase_realtime add table public.studylab_social_notifications;
  end if;
end;
$$;

comment on table public.studylab_social_notifications is
  'Simple per-user StudyLab Social notifications for post likes and comments.';
