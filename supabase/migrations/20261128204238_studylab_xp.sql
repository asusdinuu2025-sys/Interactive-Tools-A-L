-- StudyLab XP. Apply after the Study Room credit journal and Plus billing foundation.
-- Public RPCs expose bounded XP summaries and own tasks. Balances and source events
-- are writable only inside trusted transactions.
begin;

create schema studylab_xp;
revoke all on schema studylab_xp from public, anon, authenticated;

create table studylab_xp.launch (
  singleton boolean primary key default true check (singleton),
  launched_at timestamptz not null
);
insert into studylab_xp.launch (launched_at) values (now());

create table studylab_xp.balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total bigint not null default 100 check (total >= 100),
  carry_seconds integer not null default 0 check (carry_seconds between 0 and 359),
  session_id uuid,
  goal_target integer not null default 0,
  goal_seconds integer not null default 0
);
create index studylab_xp_total_idx on studylab_xp.balances (total desc, user_id);

create table studylab_xp.awards (
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('welcome','study','goal','task','payment','refund')),
  event_id text not null,
  local_day date not null,
  points integer not null check (
    (source = 'refund' and points < 0) or (source <> 'refund' and points > 0)
  ),
  recorded_at timestamptz not null default now(),
  primary key (user_id, source, event_id)
);
create index studylab_xp_task_day_idx
  on studylab_xp.awards (user_id, local_day) where source = 'task';

create table studylab_xp.study_by_day (
  local_day date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  points bigint not null check (points > 0),
  primary key (local_day, user_id)
);
create index studylab_xp_study_user_idx on studylab_xp.study_by_day (user_id);

create table studylab_xp.tasks (
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id text not null check (task_id ~ '^[a-zA-Z0-9_-]{1,80}$'),
  title text not null check (length(title) <= 90),
  subject text not null default '' check (length(subject) <= 100),
  due date,
  priority text not null default 'normal' check (priority in ('normal','high','low')),
  created_day date not null,
  created_at timestamptz not null default now(),
  completed_day date,
  first_completed_day date,
  archived boolean not null default false,
  primary key (user_id, task_id),
  check (archived or length(btrim(title)) > 0)
);
create index studylab_xp_tasks_current_idx
  on studylab_xp.tasks (user_id, created_day, task_id) where not archived;

alter table studylab_xp.launch enable row level security;
alter table studylab_xp.balances enable row level security;
alter table studylab_xp.awards enable row level security;
alter table studylab_xp.study_by_day enable row level security;
alter table studylab_xp.tasks enable row level security;
revoke all on all tables in schema studylab_xp from public, anon, authenticated;

create function studylab_xp.student_exists(p_user uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1
    from auth.users u
    join public.studylab_profiles p on p.id = u.id
    where u.id = p_user and not coalesce(u.is_anonymous, false) and p.deleted_at is null
  );
$$;

create function studylab_xp.initialize(p_user uuid)
returns void language plpgsql set search_path = '' as $$
begin
  if not studylab_xp.student_exists(p_user) then return; end if;
  insert into studylab_xp.balances (user_id) values (p_user) on conflict do nothing;
  if found then
    insert into studylab_xp.awards (user_id, source, event_id, local_day, points)
    values (p_user, 'welcome', 'account', timezone('Asia/Colombo', now())::date, 100);
  end if;
end;
$$;

-- Insert one balance and one welcome award for each existing registered profile.
with added as (
  insert into studylab_xp.balances (user_id)
  select p.id
  from public.studylab_profiles p join auth.users u on u.id = p.id
  where p.deleted_at is null and not coalesce(u.is_anonymous, false)
  returning user_id
)
insert into studylab_xp.awards (user_id, source, event_id, local_day, points)
select user_id, 'welcome', 'account', timezone('Asia/Colombo', now())::date, 100 from added;

create function studylab_xp.on_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform studylab_xp.initialize(new.id);
  return new;
end;
$$;

create trigger studylab_xp_profile after insert or update of deleted_at
on public.studylab_profiles for each row execute function studylab_xp.on_profile();

-- Supabase can upgrade an anonymous account while preserving its profile UUID.
create function studylab_xp.on_auth_upgrade()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform studylab_xp.initialize(new.id);
  return new;
end;
$$;

create trigger studylab_xp_auth_upgrade after update of is_anonymous on auth.users
for each row when (old.is_anonymous is distinct from new.is_anonymous and new.is_anonymous = false)
execute function studylab_xp.on_auth_upgrade();

-- Returns points awarded by this call. The event key makes each award atomic
-- and safe to retry. Timer midnight attribution comes from the credit journal.
create function studylab_xp.add_award(
  p_user uuid, p_source text, p_id text, p_day date, p_points integer
)
returns integer language plpgsql set search_path = '' as $$
begin
  if p_points = 0 then return 0; end if;
  insert into studylab_xp.awards (user_id, source, event_id, local_day, points)
  values (p_user, p_source, p_id, p_day, p_points) on conflict do nothing;
  if not found then return 0; end if;

  update studylab_xp.balances set total = total + p_points where user_id = p_user;
  if not found then raise exception 'XP balance missing'; end if;
  if p_source in ('study','goal','task') then
    insert into studylab_xp.study_by_day as d (local_day, user_id, points)
    values (p_day, p_user, p_points)
    on conflict (local_day, user_id) do update set points = d.points + excluded.points;
  end if;
  return p_points;
end;
$$;

create function studylab_xp.credit_seconds(
  p_user uuid, p_session uuid, p_day date, p_id bigint, p_seconds integer
)
returns void language plpgsql set search_path = '' as $$
declare
  balance studylab_xp.balances%rowtype;
  new_carry integer;
  session_target integer;
  old_progress integer;
  new_progress integer;
begin
  if p_seconds <= 0 then return; end if;
  select * into balance from studylab_xp.balances where user_id = p_user for update;
  if not found then return; end if;

  new_carry := balance.carry_seconds + p_seconds;
  session_target := balance.goal_target;
  old_progress := balance.goal_seconds;
  if balance.session_id is distinct from p_session then
    -- The room assigns the session ID and locks the target at Start.
    select coalesce(m.session_target_seconds, 0) into session_target
    from public.study_room_members m
    where m.user_id = p_user and m.session_id = p_session;
    session_target := coalesce(session_target, 0);
    old_progress := 0;
  end if;
  new_progress := case when session_target >= 1800
    then least(session_target, old_progress + p_seconds) else 0 end;

  update studylab_xp.balances
  set carry_seconds = new_carry % 360, session_id = p_session,
      goal_target = session_target, goal_seconds = new_progress
  where user_id = p_user;
  perform studylab_xp.add_award(p_user, 'study', p_id::text, p_day, new_carry / 360);
  if session_target >= 1800 and old_progress < session_target and new_progress = session_target then
    perform studylab_xp.add_award(p_user, 'goal', p_day::text, p_day, 10);
  end if;
end;
$$;

-- Pending away intervals are counted only when the existing timer confirms
-- them. Statement triggers preserve time order when several intervals confirm
-- together. A carry that crosses midnight earns its point on the second day.
create function studylab_xp.on_credit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  credits public.study_room_credit_segments%rowtype;
  launch_time timestamptz := (select launched_at from studylab_xp.launch where singleton);
  confirmed_seconds integer;
begin
  for credits in
    select n.* from xp_credit_new n
    where not n.pending and n.credited_until > launch_time
    order by n.user_id, n.credited_until, n.id
  loop
    if tg_op = 'UPDATE' then
      if not exists (select 1 from xp_credit_old o where o.id = credits.id and o.pending) then
        continue;
      end if;
    end if;

    confirmed_seconds := case when credits.credited_from >= launch_time then credits.seconds
      else least(credits.seconds, greatest(0, floor(extract(epoch from credits.credited_until - launch_time))::integer))
    end;
    perform studylab_xp.credit_seconds(
      credits.user_id, credits.session_id, credits.local_day, credits.id, confirmed_seconds
    );
  end loop;
  return null;
end;
$$;

create trigger studylab_xp_credit_insert after insert on public.study_room_credit_segments
referencing new table as xp_credit_new for each statement
execute function studylab_xp.on_credit();

create trigger studylab_xp_credit_confirm after update on public.study_room_credit_segments
referencing old table as xp_credit_old new table as xp_credit_new for each statement
execute function studylab_xp.on_credit();

-- The billing journal is populated only by a trusted, provider-verified
-- settlement. A checkout return, sandbox receipt or complimentary grant
-- cannot produce an award. A repeat buy has its own verified payment ID.
create function studylab_xp.on_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  buyer uuid;
  bonus integer;
  previous_award integer;
  day_now date := timezone('Asia/Colombo', now())::date;
begin
  if new.environment <> 'live' or new.currency <> 'LKR'
     or new.state not in ('confirmed', 'refunded') then return new; end if;
  if tg_op = 'UPDATE' then
    if new.state = old.state or old.state = 'refunded' then return new; end if;
  end if;

  select o.user_id, case o.plan_months when 1 then 199 when 3 then 499 when 12 then 1799 end
  into buyer, bonus
  from public.studylab_plus_billing_orders o
  where o.id = new.order_id and o.environment = 'live'
    and o.amount_minor = new.amount_minor and o.currency = new.currency;
  if buyer is null or bonus is null or new.amount_minor <> bonus * 100
     or not studylab_xp.student_exists(buyer) then return new; end if;

  perform 1 from studylab_xp.balances where user_id = buyer for update;
  if not found then return new; end if;
  if new.state = 'refunded' then
    select a.points into previous_award from studylab_xp.awards a
    where a.user_id = buyer and a.source = 'payment' and a.event_id = new.provider_payment_id;
    if found then
      perform studylab_xp.add_award(buyer, 'refund', new.provider_payment_id, day_now, -previous_award);
    end if;
  elsif new.recorded_at >= (select launched_at from studylab_xp.launch where singleton) then
    perform studylab_xp.add_award(buyer, 'payment', new.provider_payment_id, day_now, bonus);
  end if;
  return new;
end;
$$;

create trigger studylab_xp_payment after insert or update of state
on public.studylab_plus_billing_payments for each row execute function studylab_xp.on_payment();

create function public.studylab_xp_totals(p_users uuid[])
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(b.user_id::text, b.total::text), '{}'::jsonb)
  from studylab_xp.balances b
  join public.studylab_profiles p on p.id = b.user_id
  where (select auth.uid()) is not null and cardinality(p_users) between 1 and 100
    and b.user_id = any (p_users) and p.deleted_at is null
    and (p.profile_completed_at is not null or b.user_id = (select auth.uid()));
$$;

create function public.studylab_xp_leaderboard(
  p_metric text, p_period text default 'today', p_limit integer default 50
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  viewer uuid := (select auth.uid());
  today date := timezone('Asia/Colombo', now())::date;
  first_day date;
  row_limit integer := greatest(1, least(100, coalesce(p_limit, 50)));
  entries jsonb := '[]'::jsonb;
  own_score bigint;
  own_rank bigint;
begin
  if viewer is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if p_metric = 'total' then
    with top_rows as (
      select b.user_id, p.display_name, p.gender, b.total as score
      from studylab_xp.balances b
      join public.studylab_profiles p on p.id = b.user_id
      where p.deleted_at is null and p.profile_completed_at is not null
      order by b.total desc, b.user_id
      limit row_limit
    ), ranked as (
      select *, rank() over (order by score desc) as position from top_rows
    )
    select coalesce(jsonb_agg(
      jsonb_build_object('user_id', user_id, 'name', display_name, 'gender', gender,
        'xp', score::text, 'rank', position::text) order by position, user_id
    ), '[]'::jsonb) into entries from ranked;

    select b.total into own_score
    from studylab_xp.balances b join public.studylab_profiles p on p.id = b.user_id
    where b.user_id = viewer and p.deleted_at is null and p.profile_completed_at is not null;
    if found then
      select 1 + count(*) into own_rank from studylab_xp.balances b
      join public.studylab_profiles p on p.id = b.user_id
      where b.total > own_score and p.deleted_at is null and p.profile_completed_at is not null;
    end if;
  elsif p_metric = 'study' and p_period in ('today','week') then
    first_day := case when p_period = 'week'
      then today - (extract(isodow from today)::integer - 1) else today end;
    with earned as (
      select d.user_id, sum(d.points)::bigint as score
      from studylab_xp.study_by_day d
      where d.local_day between first_day and today
      group by d.user_id
    ), ranked as (
      select e.user_id, p.display_name, p.gender, e.score,
             rank() over (order by e.score desc) as position
      from earned e join public.studylab_profiles p on p.id = e.user_id
      where p.deleted_at is null and p.profile_completed_at is not null
    ), top_rows as (
      select * from ranked order by position, user_id limit row_limit
    )
    select coalesce((select jsonb_agg(
      jsonb_build_object('user_id', user_id, 'name', display_name, 'gender', gender,
        'xp', score::text, 'rank', position::text) order by position, user_id
    ) from top_rows), '[]'::jsonb),
      (select score from ranked where user_id = viewer),
      (select position from ranked where user_id = viewer)
    into entries, own_score, own_rank;
  else
    raise exception 'Choose Total XP or a Study XP period' using errcode = '22023';
  end if;

  return jsonb_build_object('entries', entries, 'own',
    case when own_rank is not null then jsonb_build_object('xp', own_score::text, 'rank', own_rank::text) else null end);
end;
$$;

create function studylab_xp.task_list(p_user uuid)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.task_id, 'title', t.title, 'subject', t.subject, 'due', t.due,
    'priority', t.priority, 'createdAt', t.created_day,
    'done', t.completed_day is not null, 'doneAt', t.completed_day
  ) order by t.created_day desc, t.created_at desc, t.task_id desc), '[]'::jsonb)
  from studylab_xp.tasks t where t.user_id = p_user and not t.archived;
$$;

create function studylab_xp.lock_owner()
returns uuid language plpgsql set search_path = '' as $$
declare
  viewer uuid := (select auth.uid());
begin
  if not studylab_xp.student_exists(viewer) then
    raise exception 'Registered profile required' using errcode = '42501';
  end if;
  perform 1 from studylab_xp.balances where user_id = viewer for update;
  if not found then raise exception 'XP balance unavailable'; end if;
  return viewer;
end;
$$;

create function public.studylab_xp_tasks()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare viewer uuid := (select auth.uid());
begin
  if not studylab_xp.student_exists(viewer) then
    raise exception 'Registered profile required' using errcode = '42501';
  end if;
  return studylab_xp.task_list(viewer);
end;
$$;

create function public.studylab_xp_task_save(
  p_id text, p_title text, p_subject text, p_due date, p_priority text, p_create boolean
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := studylab_xp.lock_owner();
  safe_title text := btrim(coalesce(p_title, ''));
begin
  if p_id is null or p_id !~ '^[a-zA-Z0-9_-]{1,80}$' or length(safe_title) not between 1 and 90
    or length(coalesce(p_subject, '')) > 100 or coalesce(p_priority, '') not in ('normal','high','low')
    or p_create is null then
    raise exception 'Invalid task details' using errcode = '22023';
  end if;
  if p_create then
    if exists (select 1 from studylab_xp.tasks where user_id = viewer and task_id = p_id) then
      return studylab_xp.task_list(viewer);
    end if;
    if (select count(*) from studylab_xp.tasks where user_id = viewer and not archived) >= 100 then
      raise exception 'Task limit reached. Remove a task before adding another.';
    end if;
    insert into studylab_xp.tasks (user_id, task_id, title, subject, due, priority, created_day)
    values (viewer, p_id, safe_title, coalesce(p_subject, ''), p_due, p_priority,
      timezone('Asia/Colombo', now())::date);
  else
    update studylab_xp.tasks set title = safe_title, subject = coalesce(p_subject, ''),
      due = p_due, priority = p_priority
    where user_id = viewer and task_id = p_id and not archived;
    if not found then raise exception 'Task is no longer available'; end if;
  end if;
  return studylab_xp.task_list(viewer);
end;
$$;

create function public.studylab_xp_task_complete(p_id text, p_done boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := studylab_xp.lock_owner();
  day_now date := timezone('Asia/Colombo', now())::date;
  prior studylab_xp.tasks%rowtype;
  credited integer := 0;
  reason text;
begin
  if p_done is null then raise exception 'Choose a task status'; end if;
  select * into prior from studylab_xp.tasks
  where user_id = viewer and task_id = p_id and not archived;
  if not found then raise exception 'Task is no longer available'; end if;

  if p_done and prior.completed_day is null then
    update studylab_xp.tasks set completed_day = day_now,
      first_completed_day = coalesce(first_completed_day, day_now)
    where user_id = viewer and task_id = p_id;
    if prior.first_completed_day is not null then
      reason := 'previous_completion';
    elsif (select count(*) from studylab_xp.awards
           where user_id = viewer and source = 'task' and local_day = day_now) >= 3 then
      reason := 'daily_limit';
    else
      credited := studylab_xp.add_award(viewer, 'task', p_id, day_now, 4);
    end if;
  elsif not p_done and prior.completed_day is not null then
    update studylab_xp.tasks set completed_day = null where user_id = viewer and task_id = p_id;
  end if;

  return jsonb_build_object('tasks', studylab_xp.task_list(viewer), 'awarded', credited, 'reason', reason);
end;
$$;

create function public.studylab_xp_task_delete(p_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare viewer uuid := studylab_xp.lock_owner();
begin
  -- Keep only a tombstone for deduplication across old-device imports.
  update studylab_xp.tasks set archived = true, title = '', subject = '', due = null,
    priority = 'normal', completed_day = null, first_completed_day = null
  where user_id = viewer and task_id = p_id and not archived;
  return studylab_xp.task_list(viewer);
end;
$$;

-- Adopt pre-existing browser tasks, including their visible completion dates.
-- This path records no XP for pre-launch work and never overwrites cloud tasks.
create function public.studylab_xp_task_import(p_tasks jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := studylab_xp.lock_owner();
  item jsonb;
  day_now date := timezone('Asia/Colombo', now())::date;
  done_day date;
  created date;
  remaining integer;
  waiting integer := 0;
begin
  if coalesce(jsonb_typeof(p_tasks), '') <> 'array' then
    raise exception 'Invalid task import' using errcode = '22023';
  end if;
  if jsonb_array_length(p_tasks) > 100 or octet_length(p_tasks::text) > 65536 then
    raise exception 'Too many tasks to import' using errcode = '22023';
  end if;

  select 100 - count(*)::integer into remaining
  from studylab_xp.tasks where user_id = viewer and not archived;
  for item in select value from jsonb_array_elements(p_tasks) loop
    if coalesce(item->>'id', '') !~ '^[a-zA-Z0-9_-]{1,80}$'
      or length(btrim(coalesce(item->>'title',''))) not between 1 and 90 then continue; end if;

    if exists (select 1 from studylab_xp.tasks where user_id = viewer and task_id = item->>'id') then
      continue;
    end if;
    if remaining <= 0 then
      waiting := waiting + 1;
      continue;
    end if;
    created := day_now;
    if item->>'createdAt' ~ '^\d{4}-\d{2}-\d{2}$' and pg_input_is_valid(item->>'createdAt', 'date') then
      created := least(day_now, (item->>'createdAt')::date);
    end if;
    done_day := null;
    if item->'done' = 'true'::jsonb then
      done_day := day_now;
      if item->>'doneAt' ~ '^\d{4}-\d{2}-\d{2}$' and pg_input_is_valid(item->>'doneAt', 'date') then
        done_day := least(day_now, (item->>'doneAt')::date);
      end if;
    end if;
    insert into studylab_xp.tasks (user_id, task_id, title, subject, due,
      priority, created_day, completed_day, first_completed_day)
    values (viewer, item->>'id', btrim(item->>'title'), left(coalesce(item->>'subject', ''), 100),
      case when item->>'due' ~ '^\d{4}-\d{2}-\d{2}$' and pg_input_is_valid(item->>'due', 'date')
        then (item->>'due')::date end,
      case when item->>'priority' in ('high','low') then item->>'priority' else 'normal' end,
      created, done_day, done_day) on conflict do nothing;
    if found then remaining := remaining - 1; end if;
  end loop;
  return jsonb_build_object('tasks', studylab_xp.task_list(viewer), 'waiting', waiting);
end;
$$;

revoke all on all functions in schema studylab_xp from public, anon, authenticated;
revoke all on function public.studylab_xp_totals(uuid[]),
  public.studylab_xp_leaderboard(text,text,integer), public.studylab_xp_tasks(),
  public.studylab_xp_task_save(text,text,text,date,text,boolean),
  public.studylab_xp_task_complete(text,boolean), public.studylab_xp_task_delete(text),
  public.studylab_xp_task_import(jsonb) from public, anon, authenticated;
grant execute on function public.studylab_xp_totals(uuid[]),
  public.studylab_xp_leaderboard(text,text,integer), public.studylab_xp_tasks(),
  public.studylab_xp_task_save(text,text,text,date,text,boolean),
  public.studylab_xp_task_complete(text,boolean), public.studylab_xp_task_delete(text),
  public.studylab_xp_task_import(jsonb) to authenticated;

commit;
