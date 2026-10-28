-- Enforce one human display name per StudyLab account.
-- Comparisons ignore case and collapse repeated whitespace.
-- Generated placeholder names are exempt until students choose their real display name.

create unique index if not exists studylab_profiles_display_name_normalized_uidx
on public.studylab_profiles (
  lower(regexp_replace(btrim(display_name), '[[:space:]]+', ' ', 'g'))
)
where display_name !~ '^Student[0-9]{4}$';

create or replace function public.enforce_studylab_display_name_unique()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.display_name := regexp_replace(btrim(new.display_name), '[[:space:]]+', ' ', 'g');

  if new.display_name !~ '^Student[0-9]{4}$'
     and exists (
       select 1
       from public.studylab_profiles p
       where p.id <> new.id
         and p.display_name !~ '^Student[0-9]{4}$'
         and lower(regexp_replace(btrim(p.display_name), '[[:space:]]+', ' ', 'g')) =
             lower(regexp_replace(btrim(new.display_name), '[[:space:]]+', ' ', 'g'))
     ) then
    raise exception 'DISPLAY_NAME_TAKEN' using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_studylab_display_name_unique() from public, anon, authenticated;

drop trigger if exists enforce_studylab_display_name_unique on public.studylab_profiles;
create trigger enforce_studylab_display_name_unique
before insert or update of display_name on public.studylab_profiles
for each row execute function public.enforce_studylab_display_name_unique();

create or replace function public.check_studylab_display_name_available(p_display_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and length(regexp_replace(btrim(coalesce(p_display_name, '')), '[[:space:]]+', ' ', 'g')) between 2 and 60
    and (
      regexp_replace(btrim(coalesce(p_display_name, '')), '[[:space:]]+', ' ', 'g') ~ '^Student[0-9]{4}$'
      or not exists (
        select 1
        from public.studylab_profiles p
        where p.id <> auth.uid()
          and p.display_name !~ '^Student[0-9]{4}$'
          and lower(regexp_replace(btrim(p.display_name), '[[:space:]]+', ' ', 'g')) =
              lower(regexp_replace(btrim(p_display_name), '[[:space:]]+', ' ', 'g'))
      )
    );
$$;

revoke all on function public.check_studylab_display_name_available(text) from public, anon;
grant execute on function public.check_studylab_display_name_available(text) to authenticated;
