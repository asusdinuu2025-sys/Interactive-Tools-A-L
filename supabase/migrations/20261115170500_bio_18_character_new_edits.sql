-- New Bio edits allow at most 18 Unicode characters (Postgres char_length).
-- Preserve existing Bio values, including older entries above the new limit.
-- A trigger checks only newly supplied or changed Bio text, not unrelated edits.
create or replace function studylab_private.require_short_bio_on_change()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') then
    if char_length(coalesce(new.bio,'')) > 18 then
      raise exception 'Bio must be 18 characters or fewer.' using errcode = '23514';
    end if;
  elsif (new.bio is distinct from old.bio and char_length(coalesce(new.bio,'')) > 18) then
    raise exception 'Bio must be 18 characters or fewer.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists studylab_profile_short_bio on public.studylab_profiles;
create trigger studylab_profile_short_bio
before insert or update of bio on public.studylab_profiles
for each row execute function studylab_private.require_short_bio_on_change();
