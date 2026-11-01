create or replace function public.studylab_social_prepare_comment()
returns trigger language plpgsql security invoker
set search_path = public, pg_temp as $$
declare profile_row public.studylab_profiles%rowtype;
begin
  if auth.uid() is null or new.author_id is distinct from auth.uid() then raise exception 'Authentication required'; end if;
  select * into profile_row from public.studylab_profiles where id = auth.uid();
  if not found or profile_row.display_name is null
     or profile_row.display_name ~ '^Student[0-9]{4}$'
     or profile_row.username is null or profile_row.exam_year is null
     or profile_row.study_stream is null then
    raise exception 'Complete your basic StudyLab profile before commenting';
  end if;
  if not exists (select 1 from public.studylab_social_posts where id = new.post_id and status = 'approved') then
    raise exception 'Comments are available on approved posts only';
  end if;
  new.author_display_name := profile_row.display_name;
  new.author_username := profile_row.username;
  new.body := btrim(coalesce(new.body, ''));
  new.status := 'pending';
  new.created_at := now();
  return new;
end; $$;