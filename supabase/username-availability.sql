-- Optional custom usernames with a safe availability check.
-- The existing unique index studylab_profiles_username_unique remains the
-- final guard against two students claiming the same username.
create or replace function public.studylab_username_is_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when p_username is null or p_username !~ '^[a-z0-9_]{3,24}$' then false
    else not exists (
      select 1
      from public.studylab_profiles as p
      where p.username = p_username
        and p.id <> (select auth.uid())
    )
  end;
$function$;

revoke all on function public.studylab_username_is_available(text) from public, anon;
grant execute on function public.studylab_username_is_available(text) to authenticated;
