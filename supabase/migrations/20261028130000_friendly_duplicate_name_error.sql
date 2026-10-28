-- Keep the duplicate-name error understandable even on older cached front-end code.
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
    raise exception using
      errcode = '23505',
      message = 'Name already taken. Enter more of your name or try a new one.',
      detail = 'DISPLAY_NAME_TAKEN';
  end if;

  return new;
end;
$$;
