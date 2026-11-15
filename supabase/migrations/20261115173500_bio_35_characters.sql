-- New / edited StudyLab Bios: 35 Unicode characters.
-- Preserve legacy longer Bios on ordinary profile updates; do not truncate.
-- The previous word-count CHECK would wrongly reject 35-character Bios with
-- many short words, so the change-only trigger becomes authoritative.
alter table public.studylab_profiles
  drop constraint if exists studylab_profiles_bio_word_limit;

create or replace function studylab_private.require_short_bio_on_change()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if char_length(coalesce(new.bio,'')) > 35 then
      raise exception 'Bio must be 35 characters or fewer.' using errcode = '23514';
    end if;
  elsif new.bio is distinct from old.bio
      and char_length(coalesce(new.bio,'')) > 35 then
    raise exception 'Bio must be 35 characters or fewer.' using errcode = '23514';
  end if;
  return new;
end;
$$;
-- Existing studylab_profile_short_bio trigger remains attached.
