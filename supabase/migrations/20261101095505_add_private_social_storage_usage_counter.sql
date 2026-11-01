create or replace function public.studylab_social_storage_usage_bytes()
returns bigint language sql stable security definer
set search_path = public, pg_temp as $$
  select coalesce(sum(case
    when coalesce(metadata ->> 'size', metadata ->> 'contentLength') ~ '^[0-9]+$'
    then coalesce(metadata ->> 'size', metadata ->> 'contentLength')::bigint
    else 0 end), 0)::bigint
  from storage.objects where bucket_id = 'studylab-social';
$$;
revoke all on function public.studylab_social_storage_usage_bytes() from public, anon, authenticated;
grant execute on function public.studylab_social_storage_usage_bytes() to service_role;