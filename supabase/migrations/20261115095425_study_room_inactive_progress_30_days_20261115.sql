-- Inactive Study Room progress only. Never delete students, profiles,
-- Social content, follow relationships, or unrelated data.
alter table public.study_room_members
  add column if not exists last_room_visit_at timestamptz not null default now();

-- Called once when the user enters the room, then on return to a visible tab.
-- No arbitrary user ID argument, and the private owner is the authenticated user.
create or replace function public.study_room_record_visit()
returns void language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'Not signed in'; end if;
  update public.study_room_members
     set last_room_visit_at = now()
   where user_id = v_user_id;
end $$;
revoke all on function public.study_room_record_visit() from public, anon;
grant execute on function public.study_room_record_visit() to authenticated;

-- Use a single atomic transaction per cron invocation. The last recorded
-- real visit OR active heartbeat must be at least 30 days old. Membership
-- and its progress-only history can be recreated by the existing room gate.
create or replace function studylab_private.purge_inactive_room_progress()
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid; v_deleted integer := 0;
begin
  for v_user_id in
    select m.user_id
    from public.study_room_members m
    where m.last_room_visit_at < now() - interval '30 days'
      and (m.last_heartbeat_at is null
           or m.last_heartbeat_at < now() - interval '30 days')
    for update skip locked
  loop
    delete from public.study_room_personal_sessions where user_id=v_user_id;
    delete from public.study_room_personal_daily where user_id=v_user_id;
    delete from public.study_room_credit_segments where user_id=v_user_id;
    delete from public.study_room_members where user_id=v_user_id;
    v_deleted:=v_deleted+1;
  end loop;
  return v_deleted;
end $$;
revoke all on function studylab_private.purge_inactive_room_progress()
  from public, anon, authenticated;

-- Supabase pg_cron is GMT. 18:40 UTC = 00:10 in Sri Lanka.
-- A daily run is sufficient for a 30-day inactivity policy.
select cron.schedule(
  'studylab-study-room-inactive-progress-30d',
  '40 18 * * *',
  'select studylab_private.purge_inactive_room_progress();'
);
