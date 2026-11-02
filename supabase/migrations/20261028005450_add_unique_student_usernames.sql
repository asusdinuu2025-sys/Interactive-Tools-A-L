-- Recovered from the applied Supabase migration ledger on 2026-11-02.
-- Original SQL statements are preserved from supabase_migrations.schema_migrations.

alter table public.studylab_profiles
  add column if not exists username text;

update public.studylab_profiles
set username =
  left(
    coalesce(nullif(regexp_replace(lower(display_name), '[^a-z0-9_]+', '_', 'g'), ''), 'student'),
    13
  ) || '_' || substr(replace(id::text, '-', ''), 1, 10)
where username is null;

alter table public.studylab_profiles
  alter column username set default (
    'student_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10)
  );

alter table public.studylab_profiles
  alter column username set not null;

alter table public.studylab_profiles
  add constraint studylab_profiles_username_format
  check (username ~ '^[a-z0-9_]{3,24}$');

create unique index if not exists studylab_profiles_username_unique
  on public.studylab_profiles (username);

comment on column public.studylab_profiles.username is
  'Unique, lowercase student username; distinct from display_name.';
