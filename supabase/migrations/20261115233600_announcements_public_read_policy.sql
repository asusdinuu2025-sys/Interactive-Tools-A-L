-- Separate public published-banner reads from privileged admin draft reads.
drop policy if exists "Announcement read published or site admin" on public.studylab_announcements;
drop policy if exists "Public published announcements" on public.studylab_announcements;
create policy "Public published announcements" on public.studylab_announcements
  for select to anon,authenticated using (published and starts_at <= now());
drop policy if exists "Site admins can view all announcements" on public.studylab_announcements;
create policy "Site admins can view all announcements" on public.studylab_announcements
  for select to authenticated using ((select public.studylab_social_is_admin()));
