-- StudyLab feature discovery: public active announcements + personal read receipts.
-- Existing Social admin role is in Supabase-auth-managed app_metadata (not user metadata).
create table if not exists public.studylab_announcements (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'announcement'
    check (kind in ('feature','announcement','discover')),
  title text not null check (char_length(btrim(title)) between 3 and 90),
  body text not null check (char_length(btrim(body)) between 5 and 300),
  cta_label text not null default 'Explore' check (char_length(btrim(cta_label)) between 2 and 36),
  target_path text not null default '/#home-overview'
    check (char_length(target_path) between 2 and 180 and target_path like '/%'
      and target_path not like '//%' and target_path !~ '[[:cntrl:]\\]'),
  published boolean not null default false,
  starts_at timestamptz not null default now(),
  ends_at timestamptz null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index if not exists studylab_announcements_active_idx
  on public.studylab_announcements(published,starts_at desc);
alter table public.studylab_announcements enable row level security;
revoke all on public.studylab_announcements from public,anon,authenticated;
grant select on public.studylab_announcements to anon,authenticated;
grant insert,update,delete on public.studylab_announcements to authenticated;
drop policy if exists "Announcement read published or site admin" on public.studylab_announcements;
create policy "Announcement read published or site admin"
  on public.studylab_announcements for select to anon,authenticated
  using (
    (published and starts_at <= now() and (ends_at is null or ends_at > now()))
    or (select public.studylab_social_is_admin())
  );
drop policy if exists "Site admin may create announcements" on public.studylab_announcements;
create policy "Site admin may create announcements"
  on public.studylab_announcements for insert to authenticated
  with check ((select public.studylab_social_is_admin())
    and created_by=(select auth.uid()));
drop policy if exists "Site admin may edit announcements" on public.studylab_announcements;
create policy "Site admin may edit announcements"
  on public.studylab_announcements for update to authenticated
  using ((select public.studylab_social_is_admin()))
  with check ((select public.studylab_social_is_admin()));
drop policy if exists "Site admin may remove announcements" on public.studylab_announcements;
create policy "Site admin may remove announcements"
  on public.studylab_announcements for delete to authenticated
  using ((select public.studylab_social_is_admin()));

create table if not exists public.studylab_announcement_reads (
  announcement_id uuid not null references public.studylab_announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  dismissed_at timestamptz,
  opened_at timestamptz,
  primary key (announcement_id,user_id)
);
create index if not exists studylab_announcement_reads_user_idx
  on public.studylab_announcement_reads(user_id);
alter table public.studylab_announcement_reads enable row level security;
revoke all on public.studylab_announcement_reads from public,anon,authenticated;
grant select,insert,update on public.studylab_announcement_reads to authenticated;
drop policy if exists "User or admin reads receipts" on public.studylab_announcement_reads;
create policy "User or admin reads receipts"
  on public.studylab_announcement_reads for select to authenticated
  using (user_id=(select auth.uid()) or (select public.studylab_social_is_admin()));
drop policy if exists "User creates own receipt" on public.studylab_announcement_reads;
create policy "User creates own receipt"
  on public.studylab_announcement_reads for insert to authenticated
  with check (user_id=(select auth.uid()));
drop policy if exists "User updates own receipt" on public.studylab_announcement_reads;
create policy "User updates own receipt"
  on public.studylab_announcement_reads for update to authenticated
  using (user_id=(select auth.uid()))
  with check (user_id=(select auth.uid()));
