-- =========================================================
-- STUDY LAB — FEEDBACK + REACTIONS SETUP
-- Run once in Supabase SQL Editor.
-- Existing profile/account/chat/favorites/progress tables
-- remain unchanged.
-- =========================================================

-- =========================================================
-- FEEDBACK
-- =========================================================

create table if not exists public.studylab_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  category text not null
    check (category in ('bug','suggestion','resource')),
  message text not null
    check (char_length(btrim(message)) between 2 and 1200),
  page_url text not null default ''
    check (char_length(page_url) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists studylab_feedback_created_at_idx
  on public.studylab_feedback (created_at desc);

create index if not exists studylab_feedback_user_idx
  on public.studylab_feedback (user_id, created_at desc);

alter table public.studylab_feedback enable row level security;

grant insert on table public.studylab_feedback to authenticated;

revoke select, update, delete on table public.studylab_feedback
  from anon, authenticated;

drop policy if exists "StudyLab feedback insert own"
  on public.studylab_feedback;

create policy "StudyLab feedback insert own"
  on public.studylab_feedback
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and char_length(btrim(message)) between 2 and 1200
    and category in ('bug','suggestion','resource')
  );

-- =========================================================
-- REACTIONS
-- One student can toggle each reaction on each tool/resource.
-- =========================================================

create table if not exists public.studylab_reactions (
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_url text not null
    check (char_length(btrim(tool_url)) between 1 and 1000),
  reaction text not null
    check (reaction in ('useful','helpful','popular')),
  created_at timestamptz not null default now(),
  primary key (user_id, tool_url, reaction)
);

create index if not exists studylab_reactions_tool_idx
  on public.studylab_reactions (tool_url, reaction);

alter table public.studylab_reactions enable row level security;

grant select, insert, delete
  on table public.studylab_reactions
  to authenticated;

drop policy if exists "StudyLab reactions own"
  on public.studylab_reactions;

create policy "StudyLab reactions own"
  on public.studylab_reactions
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Public-to-authenticated summary RPC.
-- It exposes only counts and the requesting student's own
-- reaction state; it does not expose other students' identities.

create or replace function public.get_studylab_reaction_summary(
  p_tool_urls text[]
)
returns table (
  tool_url text,
  useful bigint,
  helpful bigint,
  popular bigint,
  mine text[]
)
language sql
security definer
set search_path = public
as $$
  with requested as (
    select distinct unnest(p_tool_urls) as tool_url
  ),
  counts as (
    select
      r.tool_url,
      count(*) filter (where r.reaction = 'useful') as useful,
      count(*) filter (where r.reaction = 'helpful') as helpful,
      count(*) filter (where r.reaction = 'popular') as popular
    from public.studylab_reactions r
    where r.tool_url = any(p_tool_urls)
    group by r.tool_url
  ),
  mine as (
    select
      r.tool_url,
      array_agg(r.reaction order by r.reaction) as mine
    from public.studylab_reactions r
    where r.user_id = auth.uid()
      and r.tool_url = any(p_tool_urls)
    group by r.tool_url
  )
  select
    q.tool_url,
    coalesce(c.useful, 0),
    coalesce(c.helpful, 0),
    coalesce(c.popular, 0),
    coalesce(m.mine, array[]::text[])
  from requested q
  left join counts c on c.tool_url = q.tool_url
  left join mine m on m.tool_url = q.tool_url
  order by q.tool_url;
$$;

revoke all on function public.get_studylab_reaction_summary(text[]) from public;
grant execute on function public.get_studylab_reaction_summary(text[]) to authenticated;

