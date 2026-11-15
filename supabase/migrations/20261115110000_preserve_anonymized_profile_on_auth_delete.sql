-- Keep exactly one privacy-safe, inactive profile row when Auth deletes a user.
-- All activity continues to cascade by its existing auth.users / post FKs.
-- Do NOT retain personal contact information after an account deletion.
alter table public.studylab_profiles
  add column if not exists deleted_at timestamptz;

-- Without this change, deleting auth.users cascades and removes the profile row.
alter table public.studylab_profiles
  drop constraint if exists studylab_profiles_id_fkey;

create schema if not exists studylab_private;
revoke all on schema studylab_private from public, anon, authenticated;

create or replace function studylab_private.archive_deleted_profile()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.studylab_profiles
  set display_name = 'Deleted student ' || substr(replace(old.id::text,'-',''),1,16),
      username = 'deleted_' || substr(replace(old.id::text,'-',''),1,16),
      school = null, phone = null, bio = null, gender = null,
      exam_year = null, study_stream = null,
      profile_completed_at = null,
      pwa_installed = 'No',
      deleted_at = now(), updated_at = now()
  where id = old.id;
  return old;
end;
$$;
revoke all on function studylab_private.archive_deleted_profile() from public, anon, authenticated;

drop trigger if exists studylab_archive_profile_before_auth_delete on auth.users;
create trigger studylab_archive_profile_before_auth_delete
before delete on auth.users
for each row execute function studylab_private.archive_deleted_profile();
