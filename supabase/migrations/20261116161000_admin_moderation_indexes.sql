-- Cover two administrator-authored foreign keys in PR #102 tables.
begin;
create index if not exists studylab_popups_created_by_idx
  on public.studylab_popups(created_by);
create index if not exists studylab_user_bans_banned_by_idx
  on studylab_private.user_bans(banned_by);
commit;
