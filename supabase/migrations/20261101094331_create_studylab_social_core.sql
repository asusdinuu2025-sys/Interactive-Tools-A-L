-- StudyLab Social: isolated core schema.
-- Additive only: does not modify existing profiles, chat, or Study Room tables.

create table if not exists public.studylab_social_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_display_name text not null,
  author_username text not null,
  body text not null default '' check (char_length(body) <= 2000),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'removed')),
  created_at timestamptz not null default now()
);

create table if not exists public.studylab_social_post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.studylab_social_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  bucket_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  created_at timestamptz not null default now()
);

create table if not exists public.studylab_social_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.studylab_social_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_display_name text not null,
  author_username text not null,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'removed')),
  created_at timestamptz not null default now()
);

create table if not exists public.studylab_social_likes (
  post_id uuid not null references public.studylab_social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists studylab_social_posts_feed_idx
  on public.studylab_social_posts (created_at desc) where status = 'approved';
create index if not exists studylab_social_posts_author_idx
  on public.studylab_social_posts (author_id, created_at desc);
create index if not exists studylab_social_images_post_idx
  on public.studylab_social_post_images (post_id);
create index if not exists studylab_social_comments_post_idx
  on public.studylab_social_comments (post_id, created_at desc) where status = 'approved';
create index if not exists studylab_social_comments_author_idx
  on public.studylab_social_comments (author_id, created_at desc);

-- The database, not the browser, supplies the public author identity and pending status.
create or replace function public.studylab_social_prepare_post()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_row public.studylab_profiles%rowtype;
begin
  if auth.uid() is null or new.author_id is distinct from auth.uid() then
    raise exception 'Authentication required';
  end if;

  select * into profile_row
  from public.studylab_profiles
  where id = auth.uid();

  if not found or profile_row.profile_completed_at is null then
    raise exception 'Complete your StudyLab profile before posting';
  end if;

  new.author_display_name := profile_row.display_name;
  new.author_username := profile_row.username;
  new.body := btrim(coalesce(new.body, ''));
  new.status := 'pending';
  new.created_at := now();
  return new;
end;
$$;

create or replace function public.studylab_social_prepare_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_row public.studylab_profiles%rowtype;
begin
  if auth.uid() is null or new.author_id is distinct from auth.uid() then
    raise exception 'Authentication required';
  end if;

  select * into profile_row
  from public.studylab_profiles
  where id = auth.uid();

  if not found or profile_row.profile_completed_at is null then
    raise exception 'Complete your StudyLab profile before commenting';
  end if;

  if not exists (
    select 1 from public.studylab_social_posts
    where id = new.post_id and status = 'approved'
  ) then
    raise exception 'Comments are available on approved posts only';
  end if;

  new.author_display_name := profile_row.display_name;
  new.author_username := profile_row.username;
  new.body := btrim(coalesce(new.body, ''));
  new.status := 'pending';
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists studylab_social_posts_prepare on public.studylab_social_posts;
create trigger studylab_social_posts_prepare
before insert on public.studylab_social_posts
for each row execute function public.studylab_social_prepare_post();

drop trigger if exists studylab_social_comments_prepare on public.studylab_social_comments;
create trigger studylab_social_comments_prepare
before insert on public.studylab_social_comments
for each row execute function public.studylab_social_prepare_comment();

alter table public.studylab_social_posts enable row level security;
alter table public.studylab_social_post_images enable row level security;
alter table public.studylab_social_comments enable row level security;
alter table public.studylab_social_likes enable row level security;

revoke all on public.studylab_social_posts from anon, authenticated;
revoke all on public.studylab_social_post_images from anon, authenticated;
revoke all on public.studylab_social_comments from anon, authenticated;
revoke all on public.studylab_social_likes from anon, authenticated;

grant select, insert on public.studylab_social_posts to authenticated;
grant select, insert on public.studylab_social_post_images to authenticated;
grant select, insert on public.studylab_social_comments to authenticated;
grant select, insert, delete on public.studylab_social_likes to authenticated;

create policy "Social posts visible when approved or owned"
on public.studylab_social_posts for select to authenticated
using (status = 'approved' or author_id = auth.uid());

create policy "Students create pending social posts"
on public.studylab_social_posts for insert to authenticated
with check (author_id = auth.uid() and status = 'pending');

create policy "Social images visible when approved or owned"
on public.studylab_social_post_images for select to authenticated
using (
  author_id = auth.uid()
  or exists (
    select 1 from public.studylab_social_posts p
    where p.id = post_id and p.status = 'approved'
  )
);

create policy "Students attach images to their pending posts"
on public.studylab_social_post_images for insert to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.studylab_social_posts p
    where p.id = post_id and p.author_id = auth.uid() and p.status = 'pending'
  )
);

create policy "Approved social comments or own comments are visible"
on public.studylab_social_comments for select to authenticated
using (status = 'approved' or author_id = auth.uid());

create policy "Students add pending comments to approved posts"
on public.studylab_social_comments for insert to authenticated
with check (author_id = auth.uid() and status = 'pending');

create policy "Likes visible on approved posts"
on public.studylab_social_likes for select to authenticated
using (
  exists (
    select 1 from public.studylab_social_posts p
    where p.id = post_id and p.status = 'approved'
  )
);

create policy "Students like approved posts"
on public.studylab_social_likes for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.studylab_social_posts p
    where p.id = post_id and p.status = 'approved'
  )
);

create policy "Students remove their own likes"
on public.studylab_social_likes for delete to authenticated
using (user_id = auth.uid());

-- Private bucket: 5 MB hard limit and raster image formats only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('studylab-social', 'studylab-social', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Social users upload only into their own pending posts"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'studylab-social'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.studylab_social_posts p
    where p.id::text = (storage.foldername(name))[2]
      and p.author_id = auth.uid()
      and p.status = 'pending'
  )
);

create policy "Social images readable by owner or approved feed viewers"
on storage.objects for select to authenticated
using (
  bucket_id = 'studylab-social'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.studylab_social_post_images i
      join public.studylab_social_posts p on p.id = i.post_id
      where i.bucket_path = name and p.status = 'approved'
    )
  )
);

comment on table public.studylab_social_posts is
  'StudyLab Social posts. New posts are always pending until moderation approves them.';
comment on table public.studylab_social_post_images is
  'Private image metadata. Each image is limited to 5 MiB and JPEG, PNG or WebP.';
comment on table public.studylab_social_comments is
  'StudyLab Social comments. New comments are always pending until moderation approves them.';
comment on table public.studylab_social_likes is
  'One like per authenticated student per post.';
