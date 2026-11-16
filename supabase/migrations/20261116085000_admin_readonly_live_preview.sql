-- StudyLab admin live-read preview, no live mutations.
-- This migration adds only narrowly scoped read-only RPCs and leaves all
-- existing profiles, policies, roles, announcement flows and admin RPCs unchanged.
--
-- Both functions deny unauthenticated/anonymous users and defer to the
-- existing server-side three-admin access gate. Never expose emails/phones.
begin;

create function public.studylab_admin_readonly_users_v1(
  p_query text default '',
  p_page integer default 0,
  p_admins boolean default false
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_total bigint;
  v_rows jsonb;
  v_query text := coalesce(p_query, '');
begin
  if auth.uid() is null
    or not coalesce(public.studylab_social_is_admin(), false)
    or coalesce((select u.is_anonymous from auth.users u where u.id = auth.uid()), true)
  then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if length(v_query) > 100 or p_page is null or p_page < 0 or p_page > 100000 or p_admins is null
  then
    raise exception 'Invalid account search' using errcode = '22023';
  end if;

  select count(*) into v_total
  from public.studylab_profiles p
  join auth.users u on u.id = p.id
  where (not p_admins or (
      coalesce(u.is_anonymous, false) = false
      and u.raw_app_meta_data->>'role' = 'admin'
      and u.id in (
        '24e78cd0-4565-407a-96f7-9cfde083f6d2'::uuid,
        '7c97a8d7-f047-4c88-883d-4bed9b1a5f99'::uuid,
        'b6c80613-8217-48ac-851b-a39a3d9bef2b'::uuid
      )
    ))
    and (coalesce(p.display_name, '') || ' ' || coalesce(p.username, ''))
      ilike '%' || v_query || '%';

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_rows
  from (
    select p.id, p.display_name, p.username, p.school, p.bio,
           p.created_at, coalesce(u.is_anonymous, false) as guest,
           (
             coalesce(u.is_anonymous, false) = false
             and u.raw_app_meta_data->>'role' = 'admin'
             and u.id in (
               '24e78cd0-4565-407a-96f7-9cfde083f6d2'::uuid,
               '7c97a8d7-f047-4c88-883d-4bed9b1a5f99'::uuid,
               'b6c80613-8217-48ac-851b-a39a3d9bef2b'::uuid
             )
           ) as admin,
           p.id in (
             '24e78cd0-4565-407a-96f7-9cfde083f6d2'::uuid,
             '7c97a8d7-f047-4c88-883d-4bed9b1a5f99'::uuid,
             'b6c80613-8217-48ac-851b-a39a3d9bef2b'::uuid,
             '1f01a0f7-2030-4e14-b561-1e17648d4b3f'::uuid
           ) as verified
    from public.studylab_profiles p
    join auth.users u on u.id = p.id
    where (not p_admins or (
      coalesce(u.is_anonymous, false) = false
      and u.raw_app_meta_data->>'role' = 'admin'
      and u.id in (
        '24e78cd0-4565-407a-96f7-9cfde083f6d2'::uuid,
        '7c97a8d7-f047-4c88-883d-4bed9b1a5f99'::uuid,
        'b6c80613-8217-48ac-851b-a39a3d9bef2b'::uuid
      )
    ))
    and (coalesce(p.display_name, '') || ' ' || coalesce(p.username, ''))
       ilike '%' || v_query || '%'
    order by p.created_at desc, p.id
    limit 20 offset p_page * 20
  ) t;

  return jsonb_build_object('rows', v_rows, 'total', v_total);
end;
$function$;

create function public.studylab_admin_readonly_stats_v1()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if auth.uid() is null
    or not coalesce(public.studylab_social_is_admin(), false)
    or coalesce((select u.is_anonymous from auth.users u where u.id = auth.uid()), true)
  then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'profiles', (select count(*) from public.studylab_profiles),
    'registered', (
      select count(*) from public.studylab_profiles p
      join auth.users u on u.id = p.id
      where coalesce(u.is_anonymous, false) = false
    ),
    'guests', (
      select count(*) from public.studylab_profiles p
      join auth.users u on u.id = p.id
      where coalesce(u.is_anonymous, false) = true
    ),
    'admins', (
      select count(*) from auth.users u
      where coalesce(u.is_anonymous, false) = false
        and u.raw_app_meta_data->>'role' = 'admin'
        and u.id in (
          '24e78cd0-4565-407a-96f7-9cfde083f6d2'::uuid,
          '7c97a8d7-f047-4c88-883d-4bed9b1a5f99'::uuid,
          'b6c80613-8217-48ac-851b-a39a3d9bef2b'::uuid
        )
    ),
    'social_posts', (select count(*) from public.studylab_social_posts),
    'reports', (select count(*) from public.studylab_social_reports)
  );
end;
$function$;

revoke all on function public.studylab_admin_readonly_users_v1(text,integer,boolean) from public, anon;
revoke all on function public.studylab_admin_readonly_stats_v1() from public, anon;
grant execute on function public.studylab_admin_readonly_users_v1(text,integer,boolean) to authenticated;
grant execute on function public.studylab_admin_readonly_stats_v1() to authenticated;

commit;
