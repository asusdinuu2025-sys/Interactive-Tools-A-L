-- StudyLab public student milestone count
-- Run this ONCE in the Supabase SQL Editor.
-- This exposes only an aggregate count, never student names or rows.

create or replace function public.studylab_public_student_count()
returns bigint
language sql
security definer
set search_path = public
as $$
  select count(*)::bigint
    from public.studylab_profiles;
$$;

revoke all on function public.studylab_public_student_count() from public, anon, authenticated;
grant execute on function public.studylab_public_student_count() to anon, authenticated;
